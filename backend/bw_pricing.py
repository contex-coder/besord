"""BW pricing for personal ads (PF only). Default values, mutable via admin.

Empresas/B2B continuam a pagar em EUR via Stripe (módulo `pricing.py`).
Aqui apenas o equivalente para utilizadores pessoa física que gastam BW.
"""

BW_TIERS_DEFAULTS = {
    "local":    {"name": "LOCAL",    "scope": "city",    "duration_days": 3, "bw_cost": 200,  "included_votes": 100},
    "estado":   {"name": "ESTADO",   "scope": "region",  "duration_days": 5, "bw_cost": 600,  "included_votes": 300},
    "pais":     {"name": "PAÍS",     "scope": "country", "duration_days": 7, "bw_cost": 1200, "included_votes": 600},
    "mundo":    {"name": "MUNDO",    "scope": "world",   "duration_days": 7, "bw_cost": 1300, "included_votes": 1000},
}

BW_TIER_KEYS = set(BW_TIERS_DEFAULTS.keys())
