"""Besord themes — 10 categories. Themes are OPTIONAL when creating a post.

Used by both individuals (PF) and businesses (PJ).
Keys are stable identifiers (don't translate); display names are PT-PT.
"""

THEMES = [
    {"key": "estilo",  "name": "ESTILO",  "emoji": "👗", "covers": "Moda, looks, streetwear, beleza"},
    {"key": "criar",   "name": "CRIAR",   "emoji": "🎨", "covers": "Arte, design, ilustração, IA, fotografia"},
    {"key": "casa",    "name": "CASA",    "emoji": "🏠", "covers": "Interiores, arquitectura, decoração"},
    {"key": "corpo",   "name": "CORPO",   "emoji": "💪", "covers": "Tattoo, fitness, cabelo, skincare"},
    {"key": "prato",   "name": "PRATO",   "emoji": "🍽️", "covers": "Comida, bebidas, receitas, restaurantes"},
    {"key": "cidade",  "name": "CIDADE",  "emoji": "🌆", "covers": "Urbano, viagens, lugares"},
    {"key": "move",    "name": "MOVE",    "emoji": "🚗", "covers": "Autos, motos, bicicletas, mobilidade"},
    {"key": "tech",    "name": "TECH",    "emoji": "💻", "covers": "Gadgets, IA aplicada, futuro"},
    {"key": "natura",  "name": "NATURA",  "emoji": "🌿", "covers": "Natureza, pets, plantas, sustentabilidade"},
    {"key": "vibe",    "name": "VIBE",    "emoji": "✨", "covers": "Mood, abstracto, fora-da-caixa"},
]

THEME_KEYS = {t["key"] for t in THEMES}
