"""
Feed Curator Diário — pipeline de 4 camadas com prioridade.
Garante feed activo mesmo com comunidade pequena; reduz intervenção à medida que cresce.

Camadas (por prioridade):
  1. Community signal — top posts Besord últimos 7 dias (APROVO ≥ 65%) → Unsplash
  2. Google Trends PT/BR RSS — trending cultural hoje → Unsplash
  3. Reddit RSS visual communities (DesignPorn, minimalism, brutalism, streetphotography) → Unsplash
  4. FALLBACK_THEMES — banco de 28 temas curados (último recurso)

Auto-scale: quando a comunidade publica ≥ N posts naturais/dia, o curador recua.
  < 5 posts naturais  → curador publica 3 (MAX)
  5-9  posts naturais → curador publica 2
  10-19 posts naturais→ curador publica 1
  ≥ 20 posts naturais → curador publica 0 (comunidade suficiente)

Guard: não repete palavra nas últimas 24h.
"""
import re
import os
import uuid
import random
import asyncio
import httpx
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

log = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = "llama-3.1-8b-instant"
UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY", "")
SYSTEM_USER_ID = "besord_system"

MAX_POSTS_PER_RUN = 3
WORD_BLACKLIST_HOURS = 24

# Auto-scale thresholds: posts naturais/dia → posts curados a publicar
AUTOSCALE = [(20, 0), (10, 1), (5, 2), (0, 3)]

FALLBACK_THEMES = [
    "minimalismo", "tipografia", "street art", "arquitectura brutalista",
    "fotografia de rua", "design editorial", "sustentabilidade", "silêncio urbano",
    "natureza abstrata", "cor e textura", "identidade cultural", "movimento",
    "contraste", "espaço vazio", "tradição", "inovação", "comunidade", "solidão",
    "espelho", "tempo", "memória", "fronteira", "luz e sombra", "ritmo",
    "fragmentos", "pertença", "ruptura", "equilíbrio",
]

REDDIT_FEEDS = [
    ("https://www.reddit.com/r/DesignPorn/top/.rss?t=day", "design editorial"),
    ("https://www.reddit.com/r/minimalism/top/.rss?t=day", "minimalismo"),
    ("https://www.reddit.com/r/brutalism/top/.rss?t=day", "brutalismo"),
    ("https://www.reddit.com/r/streetphotography/top/.rss?t=day", "fotografia de rua"),
]

TRENDS_FEEDS = [
    "https://trends.google.com/trends/trendingsearches/daily/rss?geo=PT",
    "https://trends.google.com/trends/trendingsearches/daily/rss?geo=BR",
]


# ── Groq helpers ─────────────────────────────────────────────────────────────

async def _groq_extract_theme(client: httpx.AsyncClient, text: str) -> Optional[str]:
    """Extrai tema visual/cultural de um título (artigo, trending, post)."""
    if not GROQ_API_KEY:
        return None
    try:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": GROQ_MODEL,
                "messages": [{"role": "user", "content":
                    f"Texto: \"{text}\"\n"
                    "Extrai um tema visual/cultural (2-4 palavras, em português) para pesquisar no Unsplash.\n"
                    "Responde APENAS com o tema. Nada mais."}],
                "max_tokens": 20, "temperature": 0.3,
            },
        )
        return r.json()["choices"][0]["message"]["content"].strip().lower()
    except Exception as e:
        log.warning(f"[feed_curator] groq theme: {e}")
        return None


async def _groq_trend_to_visual(client: httpx.AsyncClient, trend: str) -> Optional[str]:
    """
    Filtra trending terms: devolve tema visual se for relevante, None caso contrário.
    Rejeita: desporto, política, crime, saúde, celebridades sem contexto visual.
    """
    if not GROQ_API_KEY:
        return None
    try:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": GROQ_MODEL,
                "messages": [{"role": "user", "content":
                    f"Trending search: \"{trend}\"\n"
                    "É visualmente interessante para arte/design/fotografia/cultura/estilo de vida?\n"
                    "Se SIM: responde com um tema visual em português (2-4 palavras) para pesquisar no Unsplash.\n"
                    "Se NÃO (desporto, política, crime, saúde): responde APENAS com NÃO.\n"
                    "Responde APENAS com o tema ou NÃO."}],
                "max_tokens": 15, "temperature": 0.2,
            },
        )
        result = r.json()["choices"][0]["message"]["content"].strip()
        if result.upper().startswith("NÃO") or result.upper() == "NAO":
            return None
        return result.lower()
    except Exception as e:
        log.warning(f"[feed_curator] groq trend filter: {e}")
        return None


async def _groq_generate_word(client: httpx.AsyncClient, theme: str, existing_words: list) -> Optional[str]:
    """Gera 1 substantivo PT em MAIÚSCULAS (max 20 chars) para o tema. Evita existing_words."""
    if not GROQ_API_KEY:
        return None
    avoid = ", ".join(existing_words[:10]) if existing_words else "nenhuma"
    try:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": GROQ_MODEL,
                "messages": [{"role": "user", "content":
                    f"Tema: \"{theme}\".\n"
                    f"Palavras a evitar: {avoid}.\n"
                    "Gera UM substantivo em português, MAIÚSCULAS, relacionado com o tema. "
                    "Máx 20 caracteres. Sem pontuação. Responde APENAS com a palavra."}],
                "max_tokens": 10, "temperature": 0.8,
            },
        )
        word = r.json()["choices"][0]["message"]["content"].strip().upper()
        word = "".join(c for c in word if c.isalpha() or c == " ").strip()
        return word if 2 <= len(word) <= 20 else None
    except Exception as e:
        log.warning(f"[feed_curator] groq word: {e}")
        return None


# ── Unsplash ──────────────────────────────────────────────────────────────────

async def _unsplash_image(client: httpx.AsyncClient, query: str) -> Optional[str]:
    """Busca imagem do Unsplash. Retorna URL 'small' (640px, square)."""
    if not UNSPLASH_ACCESS_KEY:
        return None
    try:
        r = await client.get(
            "https://api.unsplash.com/search/photos",
            params={"query": query, "per_page": 5, "orientation": "squarish", "content_filter": "high"},
            headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"},
            timeout=8.0,
        )
        results = r.json().get("results", [])
        if not results:
            return None
        photo = random.choice(results[:5])
        return photo["urls"].get("small") or photo["urls"].get("regular")
    except Exception as e:
        log.warning(f"[feed_curator] unsplash: {e}")
        return None


# ── Fontes de temas — 4 camadas ───────────────────────────────────────────────

async def _layer1_community(db, recent_words: list) -> list[tuple[str, str]]:
    """
    Camada 1 — Community signal.
    Posts Besord com APROVO ≥ 65% nos últimos 7 dias (mínimo 3 votos).
    Extrai temas e palavras como queries para o Unsplash.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    try:
        cursor = db.posts.aggregate([
            {"$match": {
                "created_at": {"$gte": cutoff},
                "author_id": {"$ne": SYSTEM_USER_ID},
                "$expr": {"$gte": [{"$add": ["$aprovo_count", "$desaprovo_count"]}, 3]},
            }},
            {"$addFields": {
                "approval_rate": {
                    "$divide": ["$aprovo_count", {"$add": ["$aprovo_count", "$desaprovo_count"]}]
                }
            }},
            {"$match": {"approval_rate": {"$gte": 0.65}}},
            {"$sort": {"approval_rate": -1}},
            {"$limit": 15},
            {"$project": {"_id": 0, "word": 1, "theme": 1}},
        ])
        posts = await cursor.to_list(length=15)

        seen: set[str] = set()
        results: list[tuple[str, str]] = []
        recent_lower = {w.lower() for w in recent_words}

        for p in posts:
            # Usar o tema MongoDB do post como query Unsplash (ex: "design", "natureza")
            t = (p.get("theme") or "").lower()
            if t and t not in seen:
                seen.add(t)
                results.append(("community", t))
            # Usar a palavra do post como query alternativa (ex: "LIBERDADE" → "liberdade")
            w = (p.get("word") or "").lower()
            if w and w not in seen and w not in recent_lower:
                seen.add(w)
                results.append(("community", w))

        log.info(f"[feed_curator] layer1 community: {len(results)} temas")
        return results[:MAX_POSTS_PER_RUN]
    except Exception as e:
        log.warning(f"[feed_curator] layer1 error: {e}")
        return []


async def _layer2_trends(client: httpx.AsyncClient) -> list[tuple[str, str]]:
    """
    Camada 2 — Google Trends PT/BR.
    RSS público (sem API key), filtrado pela Groq para relevância visual/cultural.
    """
    raw: list[str] = []
    for url in TRENDS_FEEDS:
        try:
            r = await client.get(url, timeout=8.0, headers={"User-Agent": "Mozilla/5.0"})
            titles = re.findall(r"<title><!\[CDATA\[(.*?)\]\]></title>", r.text)
            if not titles:
                titles = re.findall(r"<title>(.*?)</title>", r.text)
            raw.extend(titles[1:6])  # skip canal title
        except Exception as e:
            log.warning(f"[feed_curator] trends RSS {url}: {e}")

    results: list[tuple[str, str]] = []
    for trend in raw[:6]:
        theme = await _groq_trend_to_visual(client, trend)
        if theme:
            results.append(("trends", theme))
        if len(results) >= MAX_POSTS_PER_RUN:
            break

    log.info(f"[feed_curator] layer2 trends: {len(results)} temas de {len(raw)} trending")
    return results


async def _layer3_reddit(client: httpx.AsyncClient) -> list[tuple[str, str]]:
    """
    Camada 3 — Reddit visual communities.
    RSS público. 1 post por subreddit para variedade.
    """
    headers = {"User-Agent": "besord-feed-curator/1.0 (curator@besord.app)"}
    results: list[tuple[str, str]] = []

    for url, fallback in REDDIT_FEEDS:
        if len(results) >= MAX_POSTS_PER_RUN:
            break
        try:
            r = await client.get(url, timeout=8.0, headers=headers, follow_redirects=True)
            titles = re.findall(r"<title><!\[CDATA\[(.*?)\]\]></title>", r.text)
            if not titles:
                titles = re.findall(r"<title>(.*?)</title>", r.text)
            # Ignorar título do canal e entradas com "reddit" no nome
            post_titles = [
                t for t in titles[1:5]
                if len(t) > 5 and "reddit" not in t.lower() and "r/" not in t.lower()
            ]
            if post_titles:
                theme = await _groq_extract_theme(client, post_titles[0])
                results.append(("reddit", theme or fallback))
            else:
                results.append(("reddit", fallback))
        except Exception as e:
            log.warning(f"[feed_curator] reddit RSS {url}: {e}")
            results.append(("reddit", fallback))

    log.info(f"[feed_curator] layer3 reddit: {len(results)} temas")
    return results


def _layer4_fallback(exclude: set[str]) -> list[tuple[str, str]]:
    """Camada 4 — banco estático de temas curados. Sempre funciona."""
    available = [t for t in FALLBACK_THEMES if t not in exclude]
    random.shuffle(available)
    return [("fallback", t) for t in available[:MAX_POSTS_PER_RUN]]


# ── Helpers DB ────────────────────────────────────────────────────────────────

async def _recent_words(db) -> list:
    """Palavras publicadas pelo curador nas últimas 24h (guard anti-repetição)."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=WORD_BLACKLIST_HOURS)
    cursor = db.posts.find(
        {"author_id": SYSTEM_USER_ID, "created_at": {"$gte": cutoff}},
        {"_id": 0, "word": 1}
    )
    return [doc["word"] async for doc in cursor]


async def _count_natural_posts_today(db) -> int:
    """Posts naturais (não-curador) publicados hoje. Usado pelo auto-scale."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return await db.posts.count_documents({
        "created_at": {"$gte": today_start},
        "author_id": {"$ne": SYSTEM_USER_ID},
    })


async def _ensure_system_user(db) -> None:
    """Cria o utilizador besord_system se não existir. Idempotente."""
    await db.users.update_one(
        {"user_id": SYSTEM_USER_ID},
        {"$setOnInsert": {
            "user_id": SYSTEM_USER_ID,
            "email": "curator@besord.app",
            "name": "Besord",
            "picture": None,
            "is_admin": False,
            "bw_balance": 0,
            "bw_total_earned": 0,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )


def _autoscale_limit(natural_posts: int) -> int:
    """Quantos posts o curador deve publicar dado N posts naturais hoje."""
    for threshold, posts in AUTOSCALE:
        if natural_posts >= threshold:
            return posts
    return MAX_POSTS_PER_RUN


# ── Entry point ───────────────────────────────────────────────────────────────

async def run_feed_curator(db) -> dict:
    """
    Executa o pipeline de 4 camadas e publica posts curados.
    Retorna stats completas para debug no endpoint cron.
    """
    await _ensure_system_user(db)
    recent_words = await _recent_words(db)
    natural_today = await _count_natural_posts_today(db)
    posts_to_publish = _autoscale_limit(natural_today)

    if posts_to_publish == 0:
        log.info(f"[feed_curator] auto-scale: {natural_today} posts naturais hoje — curador inactivo")
        return {"published": 0, "errors": [], "sources": [], "natural_posts_today": natural_today, "autoscaled": True}

    log.info(f"[feed_curator] publicando {posts_to_publish} posts (natural_today={natural_today})")

    # Recolher temas de todas as camadas
    candidate_themes: list[tuple[str, str]] = []
    themes_seen: set[str] = set()

    async with httpx.AsyncClient(timeout=12.0) as client:

        # Camada 1 — Community signal (maior prioridade)
        for source, theme in await _layer1_community(db, recent_words):
            if theme not in themes_seen:
                themes_seen.add(theme)
                candidate_themes.append((source, theme))

        # Camada 2 — Google Trends
        if len(candidate_themes) < posts_to_publish:
            for source, theme in await _layer2_trends(client):
                if theme not in themes_seen:
                    themes_seen.add(theme)
                    candidate_themes.append((source, theme))

        # Camada 3 — Reddit
        if len(candidate_themes) < posts_to_publish:
            for source, theme in await _layer3_reddit(client):
                if theme not in themes_seen:
                    themes_seen.add(theme)
                    candidate_themes.append((source, theme))

        # Camada 4 — Fallback estático
        if len(candidate_themes) < posts_to_publish:
            for source, theme in _layer4_fallback(themes_seen):
                if theme not in themes_seen:
                    themes_seen.add(theme)
                    candidate_themes.append((source, theme))

        # Publicar até posts_to_publish
        published = 0
        errors: list[str] = []
        sources_used: list[str] = []

        for source, theme in candidate_themes[:posts_to_publish]:
            try:
                image_url = await _unsplash_image(client, theme)
                if not image_url:
                    errors.append(f"[{source}] sem imagem para '{theme}'")
                    continue

                word = await _groq_generate_word(client, theme, recent_words)
                if not word:
                    word = theme.split()[0].upper()[:20]

                if word in recent_words:
                    errors.append(f"palavra duplicada: {word}")
                    continue

                post_id = f"post_{uuid.uuid4().hex[:12]}"
                now = datetime.now(timezone.utc)
                await db.posts.insert_one({
                    "post_id": post_id,
                    "word": word,
                    "image_url": image_url,
                    "image_base64": "",
                    "images_urls": [],
                    "images_base64": [],
                    "video_base64": None,
                    "is_hype": False,
                    "author_id": SYSTEM_USER_ID,
                    "author_name": "Besord",
                    "author_picture": None,
                    "created_at": now,
                    "aprovo_count": 0,
                    "desaprovo_count": 0,
                    "comments_count": 0,
                    "is_sponsored": False,
                    "is_polarized": False,
                    "is_curated": True,
                    "hidden": False,
                    "curator_theme": theme,
                    "curator_source": source,
                })
                recent_words.append(word)
                published += 1
                sources_used.append(f"{source}:{theme}")
                log.info(f"[feed_curator] ✓ '{word}' via {source} ('{theme}')")

                # Pequena pausa entre publicações para não sobrecarregar Groq
                if published < posts_to_publish:
                    await asyncio.sleep(0.5)

            except Exception as e:
                errors.append(f"[{source}] erro em '{theme}': {e}")
                log.warning(f"[feed_curator] erro: {e}")

    return {
        "published": published,
        "errors": errors,
        "sources": sources_used,
        "natural_posts_today": natural_today,
        "autoscaled": False,
    }
