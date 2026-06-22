"""
Feed Curator Diário — publica 3 posts/dia com imagens do Unsplash.
Garante que o feed tem sempre conteúdo novo, mesmo com poucos utilizadores.

Pipeline:
  1. Google News RSS → 5 artigos PT/BR cultura/arte/design
  2. Groq extrai tema de cada artigo
  3. Unsplash busca imagem por tema (content_filter=high, squarish)
  4. Groq gera 1 palavra substantivo
  5. Insere post com author_id=besord_system, is_curated=True

Fallback: se NewsAPI/Groq falhar, usa FALLBACK_THEMES aleatório.
Guard: não repete palavra nas últimas 24h.
"""
import os
import uuid
import random
import httpx
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

log = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = "llama-3.1-8b-instant"
UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY", "")
SYSTEM_USER_ID = "besord_system"

FALLBACK_THEMES = [
    "minimalismo", "tipografia", "street art", "arquitectura brutalista",
    "fotografia de rua", "design editorial", "sustentabilidade", "silêncio urbano",
    "natureza abstrata", "cor e textura", "identidade cultural", "movimento",
    "contraste", "espaço vazio", "tradição", "inovação", "comunidade", "solidão",
    "espelho", "tempo", "memória", "fronteira", "luz e sombra", "ritmo",
    "fragmentos", "pertença", "ruptura", "equilíbrio",
]

WORD_BLACKLIST_HOURS = 24
MAX_POSTS_PER_RUN = 3


async def _groq_extract_theme(client: httpx.AsyncClient, article_title: str) -> Optional[str]:
    """Extrai tema cultural/visual de um título de artigo."""
    if not GROQ_API_KEY:
        return None
    try:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": GROQ_MODEL,
                "messages": [{"role": "user", "content":
                    f"Título de artigo: \"{article_title}\"\n"
                    "Extrai um tema visual/cultural (2-4 palavras, em português) para pesquisar no Unsplash.\n"
                    "Responde APENAS com o tema. Nada mais."}],
                "max_tokens": 20, "temperature": 0.3,
            },
        )
        return r.json()["choices"][0]["message"]["content"].strip().lower()
    except Exception as e:
        log.warning(f"[feed_curator] groq theme: {e}")
        return None


async def _groq_generate_word(client: httpx.AsyncClient, theme: str, existing_words: list) -> Optional[str]:
    """Gera 1 substantivo em PT (max 20 chars) relevante para o tema. Evita existing_words."""
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
                    "Gera UM substantivo em português, em MAIÚSCULAS, relacionado com o tema. "
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


async def _fetch_news_themes(client: httpx.AsyncClient) -> list:
    """Busca artigos PT/BR de cultura via Google News RSS e extrai temas."""
    themes = []
    rss_urls = [
        "https://news.google.com/rss/search?q=arte+design+cultura&hl=pt-PT&gl=PT&ceid=PT:pt",
        "https://news.google.com/rss/search?q=fotografia+arquitectura+tendencia&hl=pt-BR&gl=BR&ceid=BR:pt",
    ]
    for url in rss_urls:
        try:
            r = await client.get(url, timeout=8.0, follow_redirects=True)
            text = r.text
            # Extrai títulos do RSS sem xml parser (evita dependência)
            import re
            titles = re.findall(r"<title><!\[CDATA\[(.*?)\]\]></title>", text)
            if not titles:
                titles = re.findall(r"<title>(.*?)</title>", text)
            titles = [t for t in titles[1:6] if len(t) > 10]  # skip canal, max 5
            for title in titles[:3]:
                theme = await _groq_extract_theme(client, title)
                if theme:
                    themes.append(theme)
        except Exception as e:
            log.warning(f"[feed_curator] rss error {url}: {e}")
    return themes[:5]


async def _unsplash_image(client: httpx.AsyncClient, query: str) -> Optional[str]:
    """Busca imagem do Unsplash para o tema. Retorna URL directa (pequena, square)."""
    if not UNSPLASH_ACCESS_KEY:
        return None
    try:
        r = await client.get(
            "https://api.unsplash.com/search/photos",
            params={
                "query": query,
                "per_page": 5,
                "orientation": "squarish",
                "content_filter": "high",
            },
            headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"},
            timeout=8.0,
        )
        results = r.json().get("results", [])
        if not results:
            return None
        # Escolher aleatoriamente dos primeiros 5 para variedade
        photo = random.choice(results[:5])
        # Usar "small" (640px) — leve, rápido no mobile
        return photo["urls"].get("small") or photo["urls"].get("regular")
    except Exception as e:
        log.warning(f"[feed_curator] unsplash error: {e}")
        return None


async def _recent_words(db) -> list:
    """Palavras publicadas pelo curador nas últimas 24h."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=WORD_BLACKLIST_HOURS)
    cursor = db.posts.find(
        {"author_id": SYSTEM_USER_ID, "created_at": {"$gte": cutoff}},
        {"_id": 0, "word": 1}
    )
    return [doc["word"] async for doc in cursor]


async def _ensure_system_user(db) -> None:
    """Cria o utilizador besord_system se não existir."""
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


async def run_feed_curator(db) -> dict:
    """
    Publica até MAX_POSTS_PER_RUN posts curados.
    Retorna {"published": N, "errors": [...]}
    """
    await _ensure_system_user(db)
    recent_words = await _recent_words(db)
    published = 0
    errors = []

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Tentar obter temas via notícias
        themes = await _fetch_news_themes(client)

        # Completar com fallbacks se necessário
        if len(themes) < MAX_POSTS_PER_RUN:
            available = [t for t in FALLBACK_THEMES if t not in themes]
            random.shuffle(available)
            themes += available[:MAX_POSTS_PER_RUN - len(themes)]

        themes = themes[:MAX_POSTS_PER_RUN]

        for theme in themes:
            try:
                image_url = await _unsplash_image(client, theme)
                if not image_url:
                    errors.append(f"Sem imagem para '{theme}'")
                    continue

                word = await _groq_generate_word(client, theme, recent_words)
                if not word:
                    # Fallback: tema capitalizado como palavra
                    word = theme.split()[0].upper()[:20]

                if word in recent_words:
                    errors.append(f"Palavra duplicada: {word}")
                    continue

                post_id = f"post_{uuid.uuid4().hex[:12]}"
                now = datetime.now(timezone.utc)
                doc = {
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
                    "theme": None,
                    "hidden": False,
                    "curator_theme": theme,
                }
                await db.posts.insert_one(doc)
                recent_words.append(word)
                published += 1
                log.info(f"[feed_curator] published '{word}' (theme: {theme})")

            except Exception as e:
                errors.append(f"Erro em '{theme}': {e}")
                log.warning(f"[feed_curator] error for theme '{theme}': {e}")

    return {"published": published, "errors": errors}
