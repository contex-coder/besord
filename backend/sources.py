"""
Fontes whitelist de eventos para o Curador Automático.
Cada fonte retorna uma lista de RawEvent (blocos de texto bruto) que o
pipeline de curadoria processa posteriormente.
"""
import asyncio
import hashlib
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional
from xml.etree import ElementTree as ET

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

# ── Raw Event model ──────────────────────────────────────────────────────────

@dataclass
class RawEvent:
    """
    Texto bruto recolhido de uma fonte. O pipeline de curadoria (curator.py)
    é responsável por extrair título, data, local, etc.
    """
    title: str
    description: str
    source_url: str
    source_type: str  # "google_news", "eventbrite", "admin_manual", etc.
    source_name: str  # legível: "Google News", "Eventbrite", "Admin"
    city_hint: str    # "Lisboa", "Porto", etc.
    fetched_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    # hash estável para deduplicação
    content_hash: str = ""
    # texto do artigo (preenchido async por _enrich_texts)
    article_text: str = ""
    
    def __post_init__(self):
        if not self.content_hash:
            raw = f"{self.title}|{self.source_url}|{self.description}".encode()
            self.content_hash = hashlib.sha256(raw).hexdigest()[:16]
    
    def full_text(self) -> str:
        """Texto completo que será enviado à Groq para extração."""
        parts = [self.title]
        if self.article_text:
            parts.append(self.article_text)
        elif self.description and self.description != self.title:
            parts.append(self.description)
        return "\n\n".join(parts)


# ── Source functions ─────────────────────────────────────────────────────────

GOOGLE_NEWS_QUERIES = [
    # Lisboa — curto prazo (hoje, esta semana)
    "agenda lisboa hoje",
    "eventos lisboa esta semana",
    "o que fazer lisboa hoje",
    "lisboa noite hoje",
    "festas lisboa este fim de semana",
    "concertos lisboa esta semana",
    # Porto — curto prazo
    "agenda porto hoje",
    "eventos porto esta semana",
    "o que fazer porto hoje",
    "porto noite hoje",
    "festas porto este fim de semana",
    # Longo prazo (agenda mensal, planeamento)
    "agenda lisboa junho 2026",
    "agenda porto junho 2026",
    "festivais lisboa 2026",
    "festivais porto 2026",
]


async def _fetch_rss(client: httpx.AsyncClient, query: str) -> List[RawEvent]:
    """Fetch Google News RSS for a given query."""
    url = (
        f"https://news.google.com/rss/search"
        f"?q={query}&hl=pt-PT&gl=PT&ceid=PT:pt-150"
    )
    try:
        resp = await client.get(url, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        log.warning(f"Google News RSS fetch failed for '{query}': {e}")
        return []

    try:
        root = ET.fromstring(resp.text)
    except ET.ParseError as e:
        log.warning(f"Google News RSS parse error for '{query}': {e}")
        return []

    city = "Lisboa" if "lisboa" in query.lower() else "Porto" if "porto" in query.lower() else ""
    results: List[RawEvent] = []
    for item in root.iter("item"):
        title = ""
        desc = ""
        link = ""
        for child in item:
            tag = child.tag.lower()
            if tag == "title":
                title = (child.text or "").strip()
            elif tag == "description":
                desc = _strip_html(child.text or "")
            elif tag == "link":
                link = (child.text or "").strip()

        if not title:
            continue
        
        # Filtrar ruído: remover prefixos de fonte tipo "G1 - "
        title = re.sub(r'^[A-Za-z0-9À-ÿ ]{1,30} [-–|] ', '', title)

        results.append(RawEvent(
            title=title,
            description=desc,
            source_url=link,
            source_type="google_news",
            source_name="Google News",
            city_hint=city,
        ))

    log.info(f"Google News '{query}': {len(results)} resultados brutos")
    return results


def _strip_html(text: str) -> str:
    """Remove HTML tags and decode entities."""
    clean = re.sub(r'<[^>]+>', ' ', text)
    clean = clean.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    clean = clean.replace("&quot;", '"').replace("&#39;", "'").replace("&apos;", "'")
    clean = re.sub(r' +', ' ', clean).strip()
    return clean


# ── Aggregator ───────────────────────────────────────────────────────────────

async def fetch_all_sources() -> List[RawEvent]:
    """
    Executa todas as fontes em paralelo, deduplica por content_hash,
    e retorna a lista consolidada de RawEvents.
    """
    async with httpx.AsyncClient() as client:
        tasks = [_fetch_rss(client, q) for q in GOOGLE_NEWS_QUERIES]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    all_events: List[RawEvent] = []
    for result in results:
        if isinstance(result, list):
            all_events.extend(result)
        else:
            log.warning(f"Source fetch exception: {result}")

    # Deduplicar por content_hash
    seen: set = set()
    unique: List[RawEvent] = []
    for e in all_events:
        if e.content_hash not in seen:
            seen.add(e.content_hash)
            unique.append(e)
    
    log.info(f"Total RawEvents: {len(all_events)} → {len(unique)} after dedup")
    return unique


async def _enrich_article_texts(events: List[RawEvent], max_concurrent: int = 4) -> None:
    """Fetches and extracts article text for events with empty/inadequate text.
    Google News RSS only provides a title + link; this augments with real article text.
    """
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def enrich_one(ev: RawEvent):
        # Skip if already has substantial text
        if len(ev.full_text()) > 500:
            return
        
        # Only attempt for google_news sources with a URL
        if ev.source_type != "google_news" or not ev.source_url:
            return
        
        async with semaphore:
            try:
                async with httpx.AsyncClient(timeout=8) as client:
                    resp = await client.get(ev.source_url, follow_redirects=True)
                    if resp.status_code != 200:
                        return
                    soup = BeautifulSoup(resp.text, "html.parser")
                    # Extract text from <p> tags
                    paragraphs = [p.get_text(strip=True) for p in soup.find_all("p")]
                    text = " ".join(p for p in paragraphs if len(p) > 30)
                    if len(text) > 100:
                        ev.article_text = text[:2000]  # max 2000 chars para Groq
            except Exception:
                pass  # silently skip failed fetches
    
    await asyncio.gather(*[enrich_one(ev) for ev in events])
    enriched = sum(1 for ev in events if ev.article_text)
    log.info(f"Article text enriched: {enriched}/{len(events)}")


# ── CLI test ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    async def main():
        logging.basicConfig(level=logging.INFO)
        events = await fetch_all_sources()
        for i, e in enumerate(events[:10]):
            print(f"\n─── {i+1}. {e.source_name} | {e.city_hint} ───")
            print(f"Title: {e.title[:120]}")
            print(f"Desc:  {e.description[:200]}")
            print(f"URL:   {e.source_url}")

    asyncio.run(main())
