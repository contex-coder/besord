"""
Iteration 14 — Campaign Theme (Phase 2)

Validates that B2B campaigns accept an optional `theme` field that:
- is rejected if not in THEME_KEYS
- is persisted and surfaced on `CampaignOut`
- propagates to the sponsored post (theme field) once campaign is activated
  (mock mode -> /check-payment activates it)
"""
import pytest
from datetime import datetime, timezone


VALID_THEME = "estilo"
INVALID_THEME = "notatheme"


@pytest.fixture(scope="module")
def business_user(mongo_db, seeded_user):
    """Promote the test user to a business by setting business_profile."""
    mongo_db.users.update_one(
        {"user_id": seeded_user["user_id"]},
        {"$set": {"business_profile": {
            "company_name": "Test Co",
            "country_code": "PT",
            "billing_email": seeded_user["email"],
        }}},
    )
    yield seeded_user
    mongo_db.users.update_one(
        {"user_id": seeded_user["user_id"]},
        {"$unset": {"business_profile": ""}},
    )
    mongo_db.campaigns.delete_many({"user_id": seeded_user["user_id"]})


def _make_payload(theme=None, word="TESTE"):
    return {
        "word": word,
        # 1x1 JPEG base64 (~60 chars) so server's >50 check passes
        "image_base64": "data:image/jpeg;base64," + ("A" * 80),
        "tier_key": "global",
        "theme": theme,
    }


class TestCampaignTheme:
    def test_reject_invalid_theme(self, base_url, auth_headers, business_user, api_client):
        r = api_client.post(
            f"{base_url}/api/business/campaigns",
            headers=auth_headers,
            json=_make_payload(theme=INVALID_THEME, word="INVALID"),
        )
        assert r.status_code == 400, r.text
        assert "tema" in r.text.lower() or "theme" in r.text.lower()

    def test_create_without_theme(self, base_url, auth_headers, business_user, api_client):
        r = api_client.post(
            f"{base_url}/api/business/campaigns",
            headers=auth_headers,
            json=_make_payload(theme=None, word="SEMTEMA"),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("theme") in (None, "")

    def test_create_with_valid_theme_persists(self, base_url, auth_headers, business_user, api_client, mongo_db):
        r = api_client.post(
            f"{base_url}/api/business/campaigns",
            headers=auth_headers,
            json=_make_payload(theme=VALID_THEME, word="COMTEMA"),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["theme"] == VALID_THEME
        # Double-check persistence in Mongo
        camp_db = mongo_db.campaigns.find_one({"campaign_id": data["campaign_id"]})
        assert camp_db is not None
        assert camp_db.get("theme") == VALID_THEME

    def test_theme_propagates_to_sponsored_post_on_activation(self, base_url, auth_headers, business_user, api_client, mongo_db):
        # Create campaign with theme
        r = api_client.post(
            f"{base_url}/api/business/campaigns",
            headers=auth_headers,
            json=_make_payload(theme=VALID_THEME, word="PROPAGA"),
        )
        assert r.status_code == 200, r.text
        camp = r.json()
        campaign_id = camp["campaign_id"]

        # Force mock-mode session id so /check-payment activates without real Stripe poll.
        # Real Stripe key in .env would otherwise return payment_status=unpaid for a fresh session.
        mongo_db.campaigns.update_one(
            {"campaign_id": campaign_id},
            {"$set": {"stripe_session_id": f"cs_test_mock_force_{campaign_id}"}},
        )

        r2 = api_client.post(
            f"{base_url}/api/business/campaigns/{campaign_id}/check-payment",
            headers=auth_headers,
        )
        assert r2.status_code == 200, r2.text
        activated = r2.json()
        assert activated["status"] == "active"
        assert activated["theme"] == VALID_THEME
        assert activated.get("post_id")

        # Verify the sponsored post in Mongo carries the theme
        post = mongo_db.posts.find_one({"post_id": activated["post_id"]})
        assert post is not None
        assert post.get("theme") == VALID_THEME
        assert post.get("is_sponsored") is True
