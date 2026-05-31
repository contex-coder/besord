"""Iteration 8 — Advertiser cancellation endpoint smoke tests.

Covers POST /api/business/campaigns/{campaign_id}/cancel:
  1. 401 without auth
  2. 404 when caller is not the owner
  3. 200 + status=canceled + refunded=false for the owner
  4. Idempotent: second call still returns canceled (200)
  5. DB checks: canceled_at, canceled_by, cancel_reason, refunded=False
  6. Linked post hidden=true, hidden_by="advertiser_cancel"
  7. campaign_audit row with event="advertiser_cancel", no_refund=True
  8. 404 for non-existent campaign id

Plus a brief regression on GET /api/business/campaigns/{id},
GET /api/posts and POST /api/posts/{id}/vote.
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL", "https://image-feedback-app.preview.emergentagent.com"
).rstrip("/")

# Small valid base64 image, padded above 50 chars
TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
)


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# Fixture: owner user (admin email, with business profile) + a second non-owner
# user. Both seeded directly into Mongo. A pending_payment campaign is created
# via the public POST /api/business/campaigns endpoint so it has a real post_id.
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def seeded(mongo_db):
    admin_email = os.environ.get("ADMIN_EMAIL", "rodrigocontecunha@gmail.com").lower()

    owner_token = f"tok_TEST_iter8_owner_{uuid.uuid4().hex[:16]}"
    other_user_id = f"user_TEST_iter8_other_{uuid.uuid4().hex[:8]}"
    other_token = f"tok_TEST_iter8_other_{uuid.uuid4().hex[:16]}"

    # ---- Owner: re-use the admin email user (or create it) ----
    owner = mongo_db.users.find_one({"email": admin_email})
    if owner:
        owner_user_id = owner["user_id"]
        # Ensure business profile exists so create_campaign passes
        if not owner.get("business_profile"):
            mongo_db.users.update_one(
                {"user_id": owner_user_id},
                {"$set": {"business_profile": {
                    "company_name": "TEST Co", "country": "Portugal", "country_code": "PT",
                    "contact_email": admin_email, "contact_name": "Owner",
                }}},
            )
    else:
        owner_user_id = f"user_TEST_iter8_owner_{uuid.uuid4().hex[:8]}"
        mongo_db.users.insert_one({
            "user_id": owner_user_id,
            "email": admin_email,
            "name": "TEST Iter8 Owner",
            "age_confirmed_at": datetime.now(timezone.utc),
            "birth_year": 1985,
            "created_at": datetime.now(timezone.utc),
            "business_profile": {
                "company_name": "TEST Co", "country": "Portugal", "country_code": "PT",
                "contact_email": admin_email, "contact_name": "Owner",
            },
        })

    # ---- Non-owner ----
    mongo_db.users.insert_one({
        "user_id": other_user_id,
        "email": f"TEST_iter8_other_{uuid.uuid4().hex[:6]}@example.com",
        "name": "TEST Iter8 Other",
        "age_confirmed_at": datetime.now(timezone.utc),
        "birth_year": 1990,
        "created_at": datetime.now(timezone.utc),
    })

    # ---- Sessions ----
    mongo_db.user_sessions.insert_many([
        {
            "session_token": owner_token, "user_id": owner_user_id,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc),
        },
        {
            "session_token": other_token, "user_id": other_user_id,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc),
        },
    ])

    yield {
        "owner_user_id": owner_user_id,
        "owner_token": owner_token,
        "other_user_id": other_user_id,
        "other_token": other_token,
    }

    # Teardown — leave the admin user alone (it may pre-exist), but clean sessions
    mongo_db.user_sessions.delete_many({"session_token": {"$in": [owner_token, other_token]}})
    mongo_db.users.delete_many({"user_id": other_user_id})
    # Clean any campaigns/audit/posts we created
    camp_ids = [c["campaign_id"] for c in mongo_db.campaigns.find({"user_id": owner_user_id, "word": {"$regex": "^TESTCANCEL"}}, {"campaign_id": 1, "_id": 0})]
    if camp_ids:
        mongo_db.campaign_audit.delete_many({"campaign_id": {"$in": camp_ids}})
        post_ids = [c.get("post_id") for c in mongo_db.campaigns.find({"campaign_id": {"$in": camp_ids}}, {"post_id": 1, "_id": 0})]
        mongo_db.posts.delete_many({"post_id": {"$in": [p for p in post_ids if p]}})
        mongo_db.campaigns.delete_many({"campaign_id": {"$in": camp_ids}})


def _create_campaign(token, word_suffix="", activate=False, mongo_db=None, user_id=None):
    """Create a campaign via the public endpoint. In mock-Stripe mode the
    campaign starts in pending_payment with post_id=None. If `activate=True`,
    we first try check-payment (mock-mode auto-pays); if Stripe is real and
    not actually paid, we fall back to activating the campaign directly in
    Mongo (creating a linked post) so we can validate the cancel side-effects.
    """
    word = f"TESTCANCEL{word_suffix}{uuid.uuid4().hex[:4].upper()}"
    r = requests.post(
        f"{BASE_URL}/api/business/campaigns",
        json={
            "word": word,
            "image_base64": TINY_PNG_B64 + "a" * 60,
            "tier_key": "local",
            "target_country_code": "PT",
            "target_city": "Lisboa",
        },
        headers=_hdr(token),
        timeout=30,
    )
    assert r.status_code == 200, f"create_campaign failed: {r.status_code} {r.text}"
    camp = r.json()
    if activate:
        # Try the normal mock-mode activation path first
        r2 = requests.post(
            f"{BASE_URL}/api/business/campaigns/{camp['campaign_id']}/check-payment",
            headers=_hdr(token),
            timeout=30,
        )
        if r2.status_code == 200 and r2.json().get("post_id"):
            return r2.json()
        # Fallback: directly activate in Mongo (real-Stripe-but-unpaid case).
        assert mongo_db is not None and user_id is not None, \
            "mongo_db and user_id required for fallback activation"
        post_id = f"post_TEST_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)
        mongo_db.posts.insert_one({
            "post_id": post_id,
            "word": camp["word"],
            "image_base64": camp["image_base64"],
            "author_id": user_id,
            "author_name": "TEST Co",
            "author_picture": None,
            "created_at": now,
            "aprovo_count": 0, "desaprovo_count": 0, "comments_count": 0,
            "reports_count": 0, "hidden": False, "is_sponsored": True,
            "campaign_id": camp["campaign_id"],
        })
        mongo_db.campaigns.update_one(
            {"campaign_id": camp["campaign_id"]},
            {"$set": {"status": "active", "starts_at": now,
                      "ends_at": now + timedelta(days=camp.get("duration_days", 1)),
                      "post_id": post_id, "paid_at": now}},
        )
        # Re-fetch via API to get the latest CampaignOut shape
        r3 = requests.get(
            f"{BASE_URL}/api/business/campaigns/{camp['campaign_id']}",
            headers=_hdr(token), timeout=15,
        )
        assert r3.status_code == 200, r3.text
        return r3.json()
    return camp


# ===========================================================================
# Advertiser cancel endpoint
# ===========================================================================
class TestAdvertiserCancel:
    def test_no_auth_returns_401(self, seeded):
        camp = _create_campaign(seeded["owner_token"], "A")
        r = requests.post(
            f"{BASE_URL}/api/business/campaigns/{camp['campaign_id']}/cancel",
            timeout=15,
        )
        assert r.status_code == 401, r.text

    def test_non_owner_returns_404(self, seeded):
        camp = _create_campaign(seeded["owner_token"], "B")
        r = requests.post(
            f"{BASE_URL}/api/business/campaigns/{camp['campaign_id']}/cancel",
            headers=_hdr(seeded["other_token"]),
            timeout=15,
        )
        assert r.status_code == 404, r.text

    def test_nonexistent_campaign_returns_404(self, seeded):
        r = requests.post(
            f"{BASE_URL}/api/business/campaigns/camp_does_not_exist/cancel",
            headers=_hdr(seeded["owner_token"]),
            timeout=15,
        )
        assert r.status_code == 404, r.text

    def test_owner_cancel_success_and_idempotent(self, seeded, mongo_db):
        camp = _create_campaign(
            seeded["owner_token"], "C",
            activate=True, mongo_db=mongo_db, user_id=seeded["owner_user_id"],
        )
        cid = camp["campaign_id"]
        post_id = camp.get("post_id")
        assert post_id, f"expected post_id on created campaign, got {camp}"

        # 1st call -> 200 + canceled
        r = requests.post(
            f"{BASE_URL}/api/business/campaigns/{cid}/cancel",
            headers=_hdr(seeded["owner_token"]),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "canceled", body
        assert body["campaign_id"] == cid

        # DB checks
        doc = mongo_db.campaigns.find_one({"campaign_id": cid})
        assert doc is not None
        assert doc.get("status") == "canceled"
        assert doc.get("canceled_at") is not None
        assert doc.get("canceled_by") == "advertiser"
        assert doc.get("cancel_reason") == "advertiser_request"
        assert doc.get("refunded") is False

        # Linked post hidden
        post_doc = mongo_db.posts.find_one({"post_id": post_id})
        assert post_doc is not None, f"post {post_id} missing"
        assert post_doc.get("hidden") is True
        assert post_doc.get("hidden_by") == "advertiser_cancel"

        # Audit row
        audit = mongo_db.campaign_audit.find_one({"campaign_id": cid, "event": "advertiser_cancel"})
        assert audit is not None, "campaign_audit row missing"
        assert audit.get("no_refund") is True

        # 2nd call -> idempotent, still 200 + canceled
        r2 = requests.post(
            f"{BASE_URL}/api/business/campaigns/{cid}/cancel",
            headers=_hdr(seeded["owner_token"]),
            timeout=15,
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["status"] == "canceled"

        # Audit row should NOT have been duplicated on idempotent re-cancel
        audit_count = mongo_db.campaign_audit.count_documents({"campaign_id": cid, "event": "advertiser_cancel"})
        assert audit_count == 1, f"expected 1 audit row, got {audit_count}"


# ===========================================================================
# Brief regression on existing endpoints
# ===========================================================================
class TestRegression:
    def test_get_campaign_by_id(self, seeded):
        camp = _create_campaign(seeded["owner_token"], "REG")
        r = requests.get(
            f"{BASE_URL}/api/business/campaigns/{camp['campaign_id']}",
            headers=_hdr(seeded["owner_token"]),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["campaign_id"] == camp["campaign_id"]

    def test_get_posts(self):
        r = requests.get(f"{BASE_URL}/api/posts", timeout=15)
        assert r.status_code == 200, r.text

    def test_vote_on_post(self, seeded, mongo_db):
        # Create a post for the owner and vote on it as the other user
        r = requests.post(
            f"{BASE_URL}/api/posts",
            json={"word": "REGVOTE", "image_base64": TINY_PNG_B64 + "a" * 60},
            headers=_hdr(seeded["owner_token"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        pid = r.json()["post_id"]
        try:
            v = requests.post(
                f"{BASE_URL}/api/posts/{pid}/vote",
                json={"vote": "aprovo"},
                headers=_hdr(seeded["other_token"]),
                timeout=15,
            )
            assert v.status_code == 200, v.text
        finally:
            mongo_db.posts.delete_one({"post_id": pid})
            mongo_db.votes.delete_many({"post_id": pid})
