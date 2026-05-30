"""Pricing tiers for Besord sponsored campaigns. All amounts in USD cents."""
from dataclasses import dataclass


@dataclass(frozen=True)
class CampaignTier:
    key: str
    name: str
    scope: str  # 'city' | 'region' | 'country' | 'world'
    duration_days: int
    amount_cents: int
    included_votes: int


TIERS: dict[str, CampaignTier] = {
    "local": CampaignTier(key="local", name="LOCAL",
                          scope="city", duration_days=1,
                          amount_cents=1900, included_votes=380),
    "regional": CampaignTier(key="regional", name="REGIONAL",
                             scope="region", duration_days=7,
                             amount_cents=4900, included_votes=980),
    "national": CampaignTier(key="national", name="NACIONAL",
                             scope="country", duration_days=30,
                             amount_cents=9900, included_votes=1980),
    "global": CampaignTier(key="global", name="GLOBAL",
                           scope="world", duration_days=60,
                           amount_cents=49900, included_votes=9980),
}


def get_tier(key: str) -> CampaignTier:
    if key not in TIERS:
        raise ValueError(f"Tier desconhecido: {key}")
    return TIERS[key]


def tiers_public() -> list[dict]:
    return [
        {
            "key": t.key,
            "name": t.name,
            "scope": t.scope,
            "duration_days": t.duration_days,
            "amount_cents": t.amount_cents,
            "amount_usd": t.amount_cents / 100,
            "included_votes": t.included_votes,
        }
        for t in TIERS.values()
    ]
