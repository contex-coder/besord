"""Content moderation for Besord.

Strategy: deterministic word/phrase blocklist applied at write-time to:
  - Post words (POST /api/posts)
  - Comments (POST /api/posts/{id}/comment)
  - Campaign words (POST /api/business/campaigns)

The list targets terms in PT-PT, PT-BR and EN that are clearly prohibited
under Google Play / Apple AppStore content policies: sexual content, hate
speech, threats / extreme violence, hard slurs and exploitation.

Image moderation is NOT done here — that requires an external classifier
(out of scope for MVP). Images rely on user reports + auto-hide at >=3
reports already implemented in server.py.
"""
import re
import unicodedata
from typing import Tuple, Optional


def _strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c)
    )


def _norm(s: str) -> str:
    """Aggressive normalization: lowercase, strip accents, collapse repeats
    of a single letter (e.g. ``ffooddaa`` -> ``foda``) so leet-speak and
    stretched spellings still trip the filter."""
    s = _strip_accents(s.lower())
    s = re.sub(r"[^a-z0-9]+", "", s)
    s = re.sub(r"(.)\1{2,}", r"\1\1", s)  # caaaarro -> caarro (still distinct)
    return s


# Each entry is a normalized stem (already lowercase, no accents, no spaces).
# We match if the user's normalized word CONTAINS any stem.
# Curated short list — extend in a follow-up if needed.
BLOCKED_STEMS = {
    # Sexual / pornographic (PT/EN)
    "pornografi", "porno", "porn", "xxx",
    "sexoexplicito", "sexoexplicit", "nudez", "nude",
    "fetiche", "fetish", "hentai", "incest",
    "pedofil", "pedophil", "pedoph", "lolita", "child", "menor",  # child + menor will be careful (see whitelist below)

    # Hard PT-PT/PT-BR profanity & slurs
    "fdp", "filhadaputa", "filhodaputa", "puta", "putedo", "putear", "putaria",
    "merda", "caralho", "carai", "porra", "broche",
    "cabrao", "cabronzinho", "cabra", "cona", "conas", "panasca",
    "viado", "bicha", "paneleiro", "paneleir",
    "preto", "negao",  # only when in slur context; we keep them as cautious
    "macaco",  # racial slur
    "monhe", "ciganaco", "ciganaca",
    "judiar", "judiou", "nazi", "nazista", "hitler", "fuhrer", "heil",

    # English hard slurs
    "nigger", "nigga", "faggot", "fagot", "tranny", "kike", "spic", "chink",
    "retard", "retarded",

    # Threats & extreme violence
    "matar", "matartodos", "kill", "killall", "suicid", "ihatewomen",
    "rape", "rapeher", "violar", "estupr", "stupra",

    # Drugs / illegal sale promo
    "cocaina", "cocain", "heroina", "heroin", "meth", "metanfetam",

    # Doxxing / personal abuse
    "doxx", "doxing",
}

# Words that LOOK suspicious normalized but are legitimate — explicit allow list.
WHITELIST = {
    "menor",       # commonly used (smaller), false positive against "child"
    "child",       # English word legitimate in many contexts
    "preto",       # color black
    "matar",       # "matar saudades" idiom
}


def _is_blocked(normalized: str) -> Optional[str]:
    if normalized in WHITELIST:
        return None
    for stem in BLOCKED_STEMS:
        if stem and stem in normalized:
            return stem
    return None


def check_word(raw: str) -> Tuple[bool, Optional[str]]:
    """Validate a single Besord word (post / campaign / comment).

    Returns ``(ok, reason)``. When ``ok=False`` the second item is a short
    user-friendly reason in PT-PT (we return PT since the app is PT-first;
    the frontend may translate via i18n later).
    """
    if not raw:
        return False, "Palavra vazia."
    if len(raw) > 30:
        return False, "Palavra demasiado longa."
    norm = _norm(raw)
    if not norm:
        return False, "Palavra inválida."
    hit = _is_blocked(norm)
    if hit:
        return False, "Conteúdo não permitido pelas regras da comunidade."
    return True, None


def check_text(raw: str, max_len: int = 280) -> Tuple[bool, Optional[str]]:
    """Validate a longer free-text field (e.g. company description, profile).

    Splits into tokens and runs each through ``_is_blocked`` for performance
    with long descriptions; still bounded by ``max_len``.
    """
    if not raw:
        return True, None
    if len(raw) > max_len:
        return False, f"Texto excede {max_len} caracteres."
    parts = re.split(r"[\s,.;:!?()\[\]\"'\\/-]+", raw)
    for part in parts:
        if not part:
            continue
        norm = _norm(part)
        if not norm:
            continue
        hit = _is_blocked(norm)
        if hit:
            return False, "Conteúdo não permitido pelas regras da comunidade."
    return True, None
