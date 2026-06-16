"""
Curador Automático — Pipeline de 5 Estágios.

  1. FETCH  — Recolhe eventos brutos das fontes whitelist (sources.py)
  2. EXTRACT — Groq extrai título, data, local, tema com confidence score
  3. VALIDATE — Regras determinísticas: passado, cidade, spam, duplicados
  4. IMAGE   — Validação de qualidade de imagem (Pillow)
  5. REVIEW  — Alta confiança → insere direto; baixa confiança → fila admin

Output: eventos limpos na collection `events` com source: "curator_ai".
"""

import asyncio
import json
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

import sources

load_dotenv()
log = logging.getLogger("curator")

# ── Config ───────────────────────────────────────────────────────────────────

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = "llama-3.1-8b-instant"  # gratuito, rápido, suficiente para extração
MAX_SOURCE_EVENTS = 80            # processar no máximo 80 raw events por execução
URGENT_DAYS = 7                  # eventos nos próximos 7 dias → bónus de confiança
URGENT_CONFIDENCE_BOOST = 10     # +10 confiança efetiva para eventos urgentes
QUEUE_DAYS = 60                  # eventos > 60 dias no futuro → sempre para revisão
COVERED_CITIES = ["Lisboa", "Porto", "lisboa", "porto", "LISBOA", "PORTO"]
MIN_CONFIDENCE_AUTO = 70   # ≥ entra direto
MIN_CONFIDENCE_REVIEW = 50  # 50-69 vai para fila de revisão (< 50 descarta)
MAX_DAYS_FUTURE = 180       # eventos > 180 dias no futuro → revisão
MAX_FUTURE_DAYS_REVIEW = 120  # > 120 dias → suspeito
SPAM_PATTERNS = [
    r'(?i)ganhe\s*dinheiro',
    r'(?i)gr[áa]tis\s*!!!',
    r'🔥{2,}',
    r'(?i)clique\s*aqui',
    r'(?i)promo[cç][ãa]o\s*imperd[íi]vel',
    r'(?i)ganhar\s*€',
]

from pydantic import field_validator


# ── Pydantic models for Groq extraction ──────────────────────────────────────

class GroqExtractedEvent(BaseModel):
    title: str = ""
    date: str = ""               # YYYY-MM-DD
    time: Optional[str] = None   # HH:MM
    location_name: str = ""
    city: str = ""
    theme: Optional[str] = None  # Música, Teatro, Arte, etc.
    confidence_title: int = 0
    confidence_date: int = 0
    confidence_location: int = 0
    confidence_overall: int = 0
    extracted: bool = False

    @field_validator("title", "date", "time", "location_name", "city", "theme", mode="before")
    @classmethod
    def coerce_to_str(cls, v):
        if v is None or v is False:
            return ""
        if v is True:
            return "true"
        return str(v) if not isinstance(v, str) else v


# ── Stage 2: Groq Extraction ─────────────────────────────────────────────────

EXTRACT_PROMPT = """És um extrator de eventos. Recebes texto de um agregador de notícias ou agendas culturais.
O texto pode descrever um ou vários eventos. Extrai SEMPRE o evento mais concreto que encontrares.
Mesmo que o texto seja uma compilação/agenda/roteiro com vários eventos, extrai o primeiro evento individual
que tenha data e local claros. Se não houver NENHUM evento com data + local, aí sim marca extracted: false.

Campos:
- title: nome do evento (max 80 chars)
- date: YYYY-MM-DD (obrigatório)
- time: HH:MM ou null
- location_name: nome do local (obrigatório)
- city: cidade (Lisboa, Porto, etc.)
- theme: categoria (Música, Teatro, Arte, Cinema, Dança, Literatura, Infantil, Desporto, Gastronomia, Outro)
- confidence_title, confidence_date, confidence_location: 0-100
- confidence_overall: 0-100
- extracted: true se consegues extrair título + data + local com confiança razoável, false se não há dados suficientes

Texto:
{text}

Responde APENAS com JSON válido, sem comentários:"""


async def _groq_extract(client: httpx.AsyncClient, text: str) -> GroqExtractedEvent:
    """Envia texto à Groq e retorna evento estruturado."""
    if not GROQ_API_KEY:
        return GroqExtractedEvent(extracted=False)

    prompt = EXTRACT_PROMPT.format(text=text[:2500])  # limitar tokens
    try:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            json={
                "model": GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": "És um extrator de eventos. Responde só JSON."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.1,
                "max_tokens": 500,
            },
            timeout=20,
        )
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"].strip()

        # Limpar possível markdown code block
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]
            if raw.endswith("```"):
                raw = raw[:-3].strip()

        data = json.loads(raw)
        return GroqExtractedEvent(**data)
    except Exception as e:
        log.warning(f"Groq extraction failed: {e}")
        return GroqExtractedEvent(extracted=False)


# ── Stage 3: Structural Validation ───────────────────────────────────────────

def _validate_structural(ev: GroqExtractedEvent, raw: sources.RawEvent) -> Optional[str]:
    """
    Retorna None se válido, ou string com motivo de rejeição.
    """
    # Data no passado
    try:
        event_date = datetime.strptime(ev.date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        if event_date < today - timedelta(days=7):  # tolerância de 7 dias (evento pode ter acabado)
            return f"Data no passado: {ev.date}"
    except (ValueError, TypeError):
        return f"Data inválida: {ev.date}"

    # Cidade não coberta
    if ev.city.lower() not in [c.lower() for c in COVERED_CITIES]:
        return f"Cidade fora de cobertura: {ev.city}"

    # Spam no título
    for pattern in SPAM_PATTERNS:
        if re.search(pattern, ev.title):
            return f"Padrão de spam detectado: {pattern}"

    # Título muito curto ou vazio
    if len(ev.title.strip()) < 5:
        return "Título demasiado curto"

    # Localização vazia
    if not ev.location_name or len(ev.location_name.strip()) < 3:
        return "Localização vazia ou demasiado curta"

    return None


# ── Stage 4: Image Quality ──────────────────────────────────────────────────

async def _validate_image(client: httpx.AsyncClient, image_url: str) -> bool:
    """Retorna True se a imagem é aceitável (≥400x400, proporção razoável)."""
    if not image_url:
        return False  # sem imagem não é erro — evento entra sem capa

    try:
        from PIL import Image
        from io import BytesIO

        resp = await client.get(image_url, timeout=10)
        if resp.status_code != 200 or len(resp.content) < 5000:
            return False
        img = Image.open(BytesIO(resp.content))
        w, h = img.size
        if w < 400 or h < 400:
            return False
        if w / h > 3 or h / w > 3:
            return False
        return True
    except Exception:
        return False


# ── DB helpers ───────────────────────────────────────────────────────────────

async def _event_exists_in_db(db, title: str, date: str, city: str) -> bool:
    """Verifica se já existe evento com título + data similares na mesma cidade."""
    date_dt = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    # Busca por data ±2 dias e fuzzy match no título
    existing = await db.events.find_one({
        "start_date": {
            "$gte": (date_dt - timedelta(days=2)).isoformat(),
            "$lte": (date_dt + timedelta(days=2)).isoformat(),
        },
        "city": {"$regex": f"^{re.escape(city)}$", "$options": "i"},
        "title": {"$regex": re.escape(title[:20])},
    }, {"_id": 1})
    return existing is not None


async def _insert_event(db, ev: GroqExtractedEvent, raw: sources.RawEvent) -> str:
    """Insere evento curado na collection events. Retorna event_id."""
    event_id = f"evt_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    start = datetime.strptime(ev.date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    end = start.replace(hour=23, minute=59, second=59) if not ev.time else start

    doc = {
        "event_id": event_id,
        "company_id": "curator_ai",
        "company_name": "Curador Besord",
        "title": ev.title,
        "description": raw.description[:500] if raw.description else "",
        "image_url": "",
        "image_base64": "",
        "event_type": "curated",
        "source": "curator_ai",
        "curator_confidence": ev.confidence_overall,
        "curator_source_url": raw.source_url,
        "curator_source_type": raw.source_type,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "time": ev.time or "00:00",
        "location": ev.location_name,
        "city": ev.city,
        "lat": None,
        "lon": None,
        "theme": ev.theme,
        "status": "active",
        "created_at": now.isoformat(),
        "sponsorships_enabled": False,
        "checkins_count": 0,
        "posts_count": 0,
    }
    await db.events.insert_one(doc)
    log.info(f"Evento inserido: {event_id} | {ev.title[:60]} | {ev.city} | conf={ev.confidence_overall}")
    return event_id


async def _queue_for_review(db, ev: GroqExtractedEvent, raw: sources.RawEvent, reason: str):
    """Coloca evento na fila de revisão (event_queue collection)."""
    queue_id = f"que_{uuid.uuid4().hex[:12]}"
    doc = {
        "queue_id": queue_id,
        "title": ev.title,
        "date": ev.date,
        "location_name": ev.location_name,
        "city": ev.city,
        "theme": ev.theme,
        "source_url": raw.source_url,
        "source_type": raw.source_type,
        "confidence_overall": ev.confidence_overall,
        "reason": reason,
        "status": "pending_review",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=48)).isoformat(),
    }
    await db.event_queue.insert_one(doc)
    log.info(f"Evento em revisão: {queue_id} | {ev.title[:60]} | reason={reason}")


# ── Main pipeline ────────────────────────────────────────────────────────────

async def run_curator(db: AsyncIOMotorClient = None) -> Dict[str, int]:
    """
    Executa o pipeline completo do curador.
    Retorna contadores: { fetched, extracted, validated, inserted, queued, rejected }
    """
    stats = {"fetched": 0, "extracted": 0, "validated": 0, "inserted": 0, "queued": 0, "rejected": 0}

    if db is None:
        mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
        client = AsyncIOMotorClient(mongo_url)
        db = client.get_default_database()

    # ═══ Stage 1: FETCH ═══
    raw_events = await sources.fetch_all_sources()
    stats["fetched"] = len(raw_events)

    if not raw_events:
        log.info("Nenhum evento bruto encontrado.")
        return stats

    # Limitar a amostra para não exceder rate limits da Groq
    raw_events = raw_events[:MAX_SOURCE_EVENTS]

    async with httpx.AsyncClient() as http:

        # ═══ Stage 2: EXTRACT ═══

        # Limitar concorrência na Groq (free tier: 30 req/min)
        semaphore = asyncio.Semaphore(2)

        async def extract_one(re: sources.RawEvent):
            async with semaphore:
                for attempt in range(3):
                    try:
                        return await _groq_extract(http, re.full_text()), re
                    except Exception as e:
                        if attempt < 2 and "429" in str(e):
                            await asyncio.sleep(2 * (attempt + 1))
                            continue
                        raise
                return GroqExtractedEvent(extracted=False), re

        tasks = [extract_one(re) for re in raw_events]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results through stages 3-5
        for result in results:
            if isinstance(result, Exception):
                continue

            groq_ev, raw = result
            if not groq_ev.extracted or groq_ev.confidence_overall < MIN_CONFIDENCE_REVIEW:
                stats["rejected"] += 1
                continue
            stats["extracted"] += 1

            # ═══ Stage 3: VALIDATE ═══
            reject_reason = _validate_structural(groq_ev, raw)
            if reject_reason:
                stats["rejected"] += 1
                log.info(f"Rejeitado: {groq_ev.title[:60]} | {reject_reason}")
                continue
            stats["validated"] += 1

            # ═══ Stage 4: IMAGE ═══
            # (google news não fornece imagens diretamente — pulamos)
            # Se houver image_url no raw, validar aqui

            # ═══ Stage 5: REVIEW ═══

            # Verificar duplicados
            if await _event_exists_in_db(db, groq_ev.title, groq_ev.date, groq_ev.city):
                stats["rejected"] += 1
                log.info(f"Duplicado: {groq_ev.title[:60]}")
                continue

            # Calcular distância temporal
            try:
                event_date = datetime.strptime(groq_ev.date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
                days_until = (event_date - today).days
            except ValueError:
                days_until = 999  # data inválida → revisão

            # Ajustar confiança efetiva com bónus de urgência
            effective_confidence = groq_ev.confidence_overall
            if 0 <= days_until <= URGENT_DAYS:
                effective_confidence += URGENT_CONFIDENCE_BOOST

            # Decisão
            if effective_confidence >= MIN_CONFIDENCE_AUTO and days_until <= QUEUE_DAYS:
                await _insert_event(db, groq_ev, raw)
                stats["inserted"] += 1
                urgency = "URGENTE" if days_until <= URGENT_DAYS else ""
                log.info(f"Inserido {urgency}: {groq_ev.title[:50]} | {groq_ev.date} (em {days_until}d) | c={effective_confidence}")
            else:
                reason = ""
                if days_until > QUEUE_DAYS:
                    reason = f"Evento distante ({days_until} dias)"
                elif effective_confidence < MIN_CONFIDENCE_AUTO:
                    reason = f"Confiança {effective_confidence}%"
                await _queue_for_review(db, groq_ev, raw, reason)
                stats["queued"] += 1

    log.info(f"Curador concluído: {stats}")
    return stats


# ── FastAPI endpoint helper ──────────────────────────────────────────────────

def curator_router(db):
    """Regista endpoints do curador no router da API."""
    from fastapi import APIRouter, HTTPException, Query
    router = APIRouter()

    @router.post("/curator/run")
    async def trigger_curator(api_key: str = Query(...)):
        """Executa o curador manualmente (protegido por API key simples)."""
        if api_key != os.getenv("CURATOR_API_KEY", "besord-curator-2026"):
            raise HTTPException(status_code=403, detail="API key inválida")
        stats = await run_curator(db)
        return {"ok": True, "stats": stats}

    @router.get("/admin/event-queue")
    async def list_queue(limit: int = Query(20, le=50)):
        """Lista eventos pendentes de revisão."""
        cursor = db.event_queue.find(
            {"status": "pending_review"},
            {"_id": 0},
        ).sort("created_at", -1).limit(limit)
        return {"items": await cursor.to_list(length=limit)}

    @router.post("/admin/event-queue/{queue_id}/approve")
    async def approve_queue(queue_id: str):
        """Aprova um evento da fila e insere-o na collection events."""
        q = await db.event_queue.find_one({"queue_id": queue_id})
        if not q:
            raise HTTPException(status_code=404, detail="Queue item não encontrado")
        if q["status"] != "pending_review":
            raise HTTPException(status_code=400, detail=f"Status: {q['status']}")

        # Criar GroqExtractedEvent simulado com os dados da fila
        ge = GroqExtractedEvent(
            title=q["title"],
            date=q["date"],
            location_name=q["location_name"],
            city=q["city"],
            theme=q.get("theme"),
            confidence_overall=100,  # aprovado manualmente → 100%
            extracted=True,
        )
        sr = sources.RawEvent(
            title=q["title"],
            description="",
            source_url=q.get("source_url", ""),
            source_type=q.get("source_type", "admin_manual"),
            source_name="Admin Review",
            city_hint=q["city"],
        )
        event_id = await _insert_event(db, ge, sr)
        await db.event_queue.update_one(
            {"queue_id": queue_id},
            {"$set": {"status": "approved", "event_id": event_id}},
        )
        return {"ok": True, "event_id": event_id}

    @router.post("/admin/event-queue/{queue_id}/reject")
    async def reject_queue(queue_id: str):
        """Rejeita um evento da fila."""
        r = await db.event_queue.update_one(
            {"queue_id": queue_id},
            {"$set": {"status": "rejected"}},
        )
        if r.matched_count == 0:
            raise HTTPException(status_code=404, detail="Queue item não encontrado")
        return {"ok": True}

    return router


# ── CLI test ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    async def main():
        logging.basicConfig(level=logging.INFO)
        stats = await run_curator()
        print("\n=== CURADOR COMPLETO ===")
        for k, v in stats.items():
            print(f"  {k}: {v}")

    asyncio.run(main())
