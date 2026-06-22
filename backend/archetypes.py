"""
Sistema de Arquétipos — 10 perfis de percepção.
Detectado deterministicamente após 10 sessões com base em padrões de voto.
"""
from typing import Optional

ARCHETYPES: dict[str, dict] = {
    "curador":     {"name": "O Curador",     "emoji": "🎨", "description": "Selecciona com rigor. Aprova pouco, mas o que aprova é significativo."},
    "generoso":    {"name": "O Generoso",    "emoji": "🤝", "description": "Aprova amplamente. Vê o melhor nas pessoas e nas coisas."},
    "explorador":  {"name": "O Explorador",  "emoji": "🧭", "description": "Muda de tema a cada sessão. Curiosidade é o teu motor."},
    "esteticista": {"name": "O Esteticista", "emoji": "✨", "description": "O visual define tudo. Forma antes de conteúdo."},
    "analista":    {"name": "O Analista",    "emoji": "📊", "description": "Consistência acima de tudo. Os teus padrões são previsíveis — e isso é poder."},
    "rebelde":     {"name": "O Rebelde",     "emoji": "⚡", "description": "Desaprova mais do que aprova. O teu filtro é apertado."},
    "naturalista": {"name": "O Naturalista", "emoji": "🌿", "description": "Gravitação constante para a natureza, orgânico, sustentável."},
    "urbanista":   {"name": "O Urbanista",   "emoji": "🏙️", "description": "A cidade é o teu habitat visual. Arquitectura, movimento, contraste."},
    "intuitivo":   {"name": "O Intuitivo",   "emoji": "🌀", "description": "Os teus padrões são difíceis de prever — e essa é a tua assinatura."},
    "critico":     {"name": "O Crítico",     "emoji": "🔍", "description": "Alto nível de exigência. Aprova raramente, comenta frequentemente."},
}

NATURE_THEMES = {"natureza", "sustentabilidade", "paisagem", "floresta", "oceano", "ambiente"}
URBAN_THEMES  = {"arquitectura", "cidade", "street art", "urban", "design", "tipografia"}


def detect_archetype(sessions: list) -> str:
    """
    Regras determinísticas baseadas nos dados das últimas 10 sessões.
    `sessions` é lista de dicts com chaves: approval_rate, dominant_theme, comments_count, aprovo_count, total_votes.
    """
    if not sessions:
        return "intuitivo"

    avg_approval = sum(s.get("approval_rate", 0.5) for s in sessions) / len(sessions)
    dominant_themes = [s.get("dominant_theme") or "" for s in sessions]
    theme_counts: dict[str, int] = {}
    for t in dominant_themes:
        if t:
            theme_counts[t] = theme_counts.get(t, 0) + 1

    top_theme = max(theme_counts, key=theme_counts.get) if theme_counts else ""
    theme_concentration = theme_counts.get(top_theme, 0) / len(sessions) if sessions else 0
    avg_comments = sum(s.get("comments_count", 0) for s in sessions) / len(sessions)

    # Regras por ordem de prioridade
    if top_theme.lower() in NATURE_THEMES and theme_concentration >= 0.5:
        return "naturalista"
    if top_theme.lower() in URBAN_THEMES and theme_concentration >= 0.5:
        return "urbanista"
    if avg_approval >= 0.75 and theme_concentration >= 0.6:
        return "analista"
    if avg_approval >= 0.75:
        return "generoso"
    if avg_approval <= 0.30 and avg_comments >= 0.5:
        return "critico"
    if avg_approval <= 0.30:
        return "rebelde"
    if avg_approval <= 0.45:
        return "curador"
    if theme_concentration <= 0.25:
        return "explorador"
    if theme_concentration >= 0.5 and 0.45 < avg_approval < 0.65:
        return "esteticista"
    return "intuitivo"
