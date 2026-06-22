"""
Daily Challenge — "Wordle da Percepção"
Toda a comunidade vê a mesma imagem, escolhe uma palavra, e o resultado revela-se às 20h UTC.

Endpoints:
  GET  /api/daily-challenge                         — challenge de hoje (público)
  POST /api/daily-challenge/vote                    — votar (auth, 1x por dia)
  POST /api/admin/daily-challenge                   — criar/substituir challenge (admin/manual)
  POST /api/admin/cron/daily-challenge-create       — gera challenge automaticamente (cron 08h UTC)
  POST /api/admin/cron/daily-challenge-reveal       — calcular top_words + Groq analysis (cron 20h UTC)
"""
import os
import uuid
import random
import httpx
import logging
from collections import Counter
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

log = logging.getLogger(__name__)

router = APIRouter()

# Injectado via build_router()
_db = None
_get_current_user = None
_moderate_word = None
_notify_user = None
_verify_cron = None


def build_router(db, get_current_user, moderate_word, notify_user, verify_cron=None):
    global _db, _get_current_user, _moderate_word, _notify_user, _verify_cron
    _db = db
    _get_current_user = get_current_user
    _moderate_word = moderate_word
    _notify_user = notify_user
    _verify_cron = verify_cron
    return router


# ── Modelos ──────────────────────────────────────────────────────────────────

class ChallengeCreate(BaseModel):
    image_url: str
    prompt_theme: str
    date: Optional[str] = None  # "YYYY-MM-DD"; se omitido usa hoje UTC


class ChallengeVote(BaseModel):
    word: str


# ── Prompts de fallback (usados quando Groq falha) ───────────────────────────

PROMPT_POOL = [
    "O que sentes ao ver isto?",
    "Uma palavra que define este momento.",
    "O que este lugar guarda em silêncio?",
    "Que emoção esta imagem desperta em ti?",
    "Se pudesses entrar nesta imagem, o que farias?",
    "O que está ausente nesta fotografia?",
    "Esta imagem fala de quê?",
    "O que esta cena ainda não disse?",
    "Que palavra escolherias para este instante?",
    "O que te atrai nesta imagem?",
]


# ── Helpers de geração automática ────────────────────────────────────────────

async def _unsplash_editorial_photo(client: httpx.AsyncClient) -> Optional[dict]:
    """Busca uma foto editorial aleatória do Unsplash. Retorna {url, description, tags}."""
    access_key = os.getenv("UNSPLASH_ACCESS_KEY", "")
    if not access_key:
        return None
    try:
        r = await client.get(
            "https://api.unsplash.com/photos",
            params={"order_by": "editorial", "per_page": 30, "content_filter": "high"},
            headers={"Authorization": f"Client-ID {access_key}"},
            timeout=8.0,
        )
        photos = r.json()
        if not photos or not isinstance(photos, list):
            return None
        photo = random.choice(photos[:20])
        description = photo.get("alt_description") or photo.get("description") or ""
        tags = [t["title"] for t in photo.get("tags", [])[:5] if isinstance(t, dict)]
        return {
            "url": photo["urls"].get("regular") or photo["urls"].get("small"),
            "description": description,
            "tags": tags,
        }
    except Exception as e:
        log.warning(f"[daily_challenge] unsplash editorial: {e}")
        return None


async def _groq_generate_prompt(client: httpx.AsyncClient, description: str, tags: list) -> str:
    """Gera uma pergunta provocadora baseada na imagem. Fallback para PROMPT_POOL."""
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        return random.choice(PROMPT_POOL)
    context = description or ", ".join(tags) or "imagem abstracta"
    try:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "llama-3.1-8b-instant",
                "messages": [{"role": "user", "content":
                    f"Imagem: \"{context}\".\n"
                    "Escreve UMA pergunta curta e provocadora (máx 8 palavras, em português) "
                    "para pedir a alguém que escolha uma palavra ao ver esta imagem. "
                    "Tom: directo, intrigante, sem ser óbvio. Sem aspas. Só a pergunta."}],
                "max_tokens": 25,
                "temperature": 0.85,
            },
        )
        result = r.json()["choices"][0]["message"]["content"].strip().rstrip(".")
        if result and len(result) > 5:
            return result if result.endswith("?") else result + "?"
        return random.choice(PROMPT_POOL)
    except Exception as e:
        log.warning(f"[daily_challenge] groq prompt: {e}")
        return random.choice(PROMPT_POOL)


# ── Helper Groq — análise do reveal ──────────────────────────────────────────

async def _groq_challenge_analysis(top_words: list, vote_count: int) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or not top_words:
        return ""
    top_str = ", ".join(f"{w['word']} ({w['count']})" for w in top_words[:5])
    prompt = (
        f"{vote_count} pessoas viram a mesma imagem. "
        f"As palavras mais escolhidas: {top_str}. "
        "Em 3 frases curtas (máx 60 palavras, em português): o que este conjunto revela "
        "sobre o olhar colectivo de hoje? "
        "Tom: analista cultural, directo, sem jargão. Sem aspas. Sem listas."
    )
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 120,
                    "temperature": 0.7,
                },
            )
            data = r.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        log.warning(f"[daily_challenge] groq error: {e}")
        return ""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/daily-challenge")
async def get_daily_challenge(authorization: Optional[str] = Header(None)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    doc = await _db.daily_challenges.find_one({"date": today}, {"_id": 0})
    if not doc:
        return {"available": False}

    user_voted_word = None
    if authorization:
        try:
            user = await _get_current_user(authorization)
            uid = user["user_id"]
            for v in doc.get("votes", []):
                if v.get("user_id") == uid:
                    user_voted_word = v.get("word")
                    break
        except Exception:
            pass

    response = {
        "available": True,
        "challenge_id": doc["challenge_id"],
        "date": doc["date"],
        "image_url": doc["image_url"],
        "prompt_theme": doc["prompt_theme"],
        "status": doc.get("status", "active"),
        "vote_count": doc.get("vote_count", 0),
        "user_voted_word": user_voted_word,
    }

    if doc.get("status") == "revealed":
        response["top_words"] = doc.get("top_words", [])
        response["analysis"] = doc.get("analysis", "")

    return response


@router.post("/daily-challenge/vote")
async def vote_daily_challenge(
    payload: ChallengeVote,
    authorization: Optional[str] = Header(None),
):
    user = await _get_current_user(authorization)
    uid = user["user_id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    doc = await _db.daily_challenges.find_one({"date": today}, {"_id": 0, "status": 1, "votes": 1, "challenge_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Não há challenge para hoje.")
    if doc.get("status") == "revealed":
        raise HTTPException(status_code=400, detail="O challenge de hoje já foi revelado.")

    for v in doc.get("votes", []):
        if v.get("user_id") == uid:
            raise HTTPException(status_code=400, detail="Já votaste no challenge de hoje.")

    word = payload.word.strip().upper()
    if not word or len(word) < 2 or len(word) > 30:
        raise HTTPException(status_code=400, detail="Palavra inválida.")
    ok, reason = _moderate_word(word)
    if not ok:
        raise HTTPException(status_code=400, detail=f"Palavra não permitida: {reason}")

    await _db.daily_challenges.update_one(
        {"date": today},
        {
            "$push": {"votes": {"user_id": uid, "word": word, "voted_at": datetime.now(timezone.utc)}},
            "$inc": {"vote_count": 1},
        },
    )
    await _db.users.update_one({"user_id": uid}, {"$inc": {"bw_balance": 1, "bw_total_earned": 1}})

    return {"ok": True, "word": word, "bw_earned": 1}


@router.post("/admin/cron/daily-challenge-create")
async def cron_create_challenge(authorization: Optional[str] = Header(None)):
    """Gera automaticamente o Daily Challenge de hoje. Idempotente. Cron: 08h UTC."""
    _verify_cron(authorization)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Idempotente — não sobrescreve se já existe
    existing = await _db.daily_challenges.find_one({"date": today}, {"_id": 0, "challenge_id": 1})
    if existing:
        return {"ok": True, "already_exists": True, "challenge_id": existing["challenge_id"]}

    async with httpx.AsyncClient() as client:
        photo = await _unsplash_editorial_photo(client)
        if not photo:
            return {"ok": False, "reason": "Unsplash indisponível. Cria o challenge manualmente."}
        prompt = await _groq_generate_prompt(client, photo["description"], photo["tags"])

    challenge_id = f"dc_{today}"
    await _db.daily_challenges.update_one(
        {"date": today},
        {"$set": {
            "challenge_id": challenge_id,
            "date": today,
            "image_url": photo["url"],
            "prompt_theme": prompt,
            "status": "active",
            "votes": [],
            "vote_count": 0,
            "top_words": [],
            "analysis": None,
            "created_at": datetime.now(timezone.utc),
            "auto_generated": True,
        }},
        upsert=True,
    )

    log.info(f"[daily_challenge] auto-gerado: {challenge_id} | '{prompt}' | {photo['url'][:60]}...")
    return {"ok": True, "challenge_id": challenge_id, "prompt": prompt, "image_url": photo["url"]}


@router.post("/admin/daily-challenge")
async def admin_create_challenge(
    payload: ChallengeCreate,
    authorization: Optional[str] = Header(None),
):
    user = await _get_current_user(authorization)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Apenas administradores.")

    date = payload.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    challenge_id = f"dc_{date}"

    await _db.daily_challenges.update_one(
        {"date": date},
        {"$set": {
            "challenge_id": challenge_id,
            "date": date,
            "image_url": payload.image_url,
            "prompt_theme": payload.prompt_theme,
            "status": "active",
            "votes": [],
            "vote_count": 0,
            "top_words": [],
            "analysis": None,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {"ok": True, "challenge_id": challenge_id, "date": date}


@router.post("/admin/cron/daily-challenge-reveal")
async def cron_reveal_challenge(authorization: Optional[str] = Header(None)):
    _verify_cron(authorization)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    doc = await _db.daily_challenges.find_one({"date": today}, {"_id": 0})
    if not doc:
        return {"ok": False, "reason": "Nenhum challenge para hoje."}
    if doc.get("status") == "revealed":
        return {"ok": False, "reason": "Já revelado."}

    votes = doc.get("votes", [])
    words = [v["word"] for v in votes]
    counter = Counter(words)
    top_words = [{"word": w, "count": c} for w, c in counter.most_common(10)]

    analysis = await _groq_challenge_analysis(top_words, len(votes))

    await _db.daily_challenges.update_one(
        {"date": today},
        {"$set": {"status": "revealed", "top_words": top_words, "analysis": analysis}},
    )

    # Notificar todos os votantes
    voter_ids = list({v["user_id"] for v in votes})
    top_word = top_words[0]["word"] if top_words else "—"
    for uid in voter_ids:
        await _notify_user(
            uid,
            f"🎯 Resultado do Challenge de Hoje",
            f"A palavra mais escolhida foi '{top_word}'. {len(votes)} participantes.",
            notif_type="challenge_reveal",
            data={"date": today},
        )

    return {"ok": True, "revealed": True, "votes": len(votes), "top_word": top_word}
