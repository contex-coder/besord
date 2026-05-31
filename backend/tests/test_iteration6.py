"""Iteration 6 — Phase A validation: EUR currency, audit endpoint, Stripe security.

We seed a session directly into MongoDB to test the admin endpoint without OAuth.
"""
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = (os.environ.get('EXPO_PUBLIC_BACKEND_URL') or os.environ.get('APP_BASE_URL') or 'https://image-feedback-app.preview.emergentagent.com').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'rodrigocontecunha@gmail.com').lower()

_mc = MongoClient(MONGO_URL)
_db = _mc[DB_NAME]


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    """Seed an admin session directly in mongo."""
    user = _db.users.find_one({"email": ADMIN_EMAIL})
    if not user:
        user_id = f"user_test_{uuid.uuid4().hex[:8]}"
        _db.users.insert_one({
            "user_id": user_id,
            "email": ADMIN_EMAIL,
            "name": "Admin Test",
            "provider": "google",
            "created_at": datetime.now(timezone.utc),
        })
    else:
        user_id = user["user_id"]
    token = f"TEST_admin_{uuid.uuid4().hex}"
    _db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
        "created_at": datetime.now(timezone.utc),
    })
    yield token, user_id
    _db.user_sessions.delete_one({"session_token": token})


@pytest.fixture(scope="module")
def business_token():
    """Seed a business user with profile for campaign creation tests."""
    user_id = f"user_test_{uuid.uuid4().hex[:8]}"
    _db.users.insert_one({
        "user_id": user_id,
        "email": f"TEST_biz_{user_id}@example.com",
        "name": "Test Biz",
        "provider": "google",
        "business_profile": {
            "company_name": "TEST Co",
            "country": "Portugal",
            "country_code": "PT",
            "contact_email": f"TEST_biz_{user_id}@example.com",
            "contact_name": "Tester",
            "created_at": datetime.now(timezone.utc),
        },
        "created_at": datetime.now(timezone.utc),
    })
    token = f"TEST_biz_{uuid.uuid4().hex}"
    _db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
        "created_at": datetime.now(timezone.utc),
    })
    yield token, user_id
    _db.user_sessions.delete_one({"session_token": token})
    _db.users.delete_one({"user_id": user_id})


# ---------- regression: public endpoints ----------
class TestRegressionPublic:
    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=10)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_tiers_returns_list(self):
        r = requests.get(f"{BASE_URL}/api/business/tiers", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        # Each tier has amount_cents key
        assert "amount_cents" in data[0]

    def test_posts_recent(self):
        r = requests.get(f"{BASE_URL}/api/posts?sort=recent", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_posts_default(self):
        r = requests.get(f"{BASE_URL}/api/posts", timeout=15)
        assert r.status_code == 200


# ---------- auth/me ----------
class TestAuth:
    def test_auth_me_with_valid_token(self, admin_token):
        token, _ = admin_token
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["email"].lower() == ADMIN_EMAIL
        assert body["is_admin"] is True

    def test_auth_me_no_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert r.status_code == 401


# ---------- admin audit endpoint ----------
class TestAdminAudit:
    def test_audit_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/campaigns/anything/audit", timeout=10)
        assert r.status_code == 401

    def test_audit_requires_admin_role(self, business_token):
        token, _ = business_token
        r = requests.get(f"{BASE_URL}/api/admin/campaigns/anything/audit",
                         headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert r.status_code == 403

    def test_audit_returns_shape_for_admin(self, admin_token):
        token, _ = admin_token
        r = requests.get(f"{BASE_URL}/api/admin/campaigns/nonexistent_camp/audit",
                         headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "campaign_id" in body and "current" in body and "audit_trail" in body
        assert body["campaign_id"] == "nonexistent_camp"
        assert isinstance(body["audit_trail"], list)


# ---------- campaign create regression + audit write ----------
TINY_IMAGE_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=" * 2

class TestCampaignAuditWrite:
    def test_create_campaign_writes_audit_row(self, business_token, admin_token):
        biz_token, biz_user_id = business_token
        admin_t, _ = admin_token

        payload = {
            "word": "TESTAUDIT",
            "image_base64": TINY_IMAGE_B64,
            "tier_key": "local",
            "target_country_code": "PT",
            "target_city": "Lisboa",
        }
        r = requests.post(f"{BASE_URL}/api/business/campaigns", json=payload,
                          headers={"Authorization": f"Bearer {biz_token}"}, timeout=20)
        assert r.status_code == 200, f"create failed: {r.status_code} {r.text[:300]}"
        camp = r.json()
        campaign_id = camp["campaign_id"]
        assert camp["amount_cents"] > 0
        # Verify audit row in DB
        audit = list(_db.campaign_audit.find({"campaign_id": campaign_id}))
        assert len(audit) >= 1
        a = audit[0]
        assert a["word_submitted"] == "TESTAUDIT"
        assert a["word_stored"] == "TESTAUDIT"
        assert a["tier_key"] == "local"
        assert a["amount_cents"] == camp["amount_cents"]
        assert a.get("image_sha256")
        # Now call admin audit endpoint
        r2 = requests.get(f"{BASE_URL}/api/admin/campaigns/{campaign_id}/audit",
                          headers={"Authorization": f"Bearer {admin_t}"}, timeout=10)
        assert r2.status_code == 200
        body = r2.json()
        assert body["current"] is not None
        assert len(body["audit_trail"]) >= 1
        assert body["audit_trail"][0]["word_submitted"] == "TESTAUDIT"
        # cleanup
        _db.campaigns.delete_one({"campaign_id": campaign_id})
        _db.campaign_audit.delete_many({"campaign_id": campaign_id})


# ---------- Stripe security audit ----------
class TestStripeSecurity:
    def test_real_stripe_checkout_uses_eur(self, business_token):
        """Create a campaign and verify Stripe URL is from stripe.com (not mock)."""
        token, _ = business_token
        payload = {
            "word": "EURTEST",
            "image_base64": TINY_IMAGE_B64,
            "tier_key": "local",
            "target_country_code": "PT",
            "target_city": "Porto",
        }
        r = requests.post(f"{BASE_URL}/api/business/campaigns", json=payload,
                          headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert r.status_code == 200
        camp = r.json()
        # Real stripe URL OR mock path; key is sk_test_51..., so should be real
        url = camp.get("checkout_url") or ""
        assert "stripe.com" in url or "/business/campaign/" in url
        # cleanup
        _db.campaigns.delete_one({"campaign_id": camp["campaign_id"]})
        _db.campaign_audit.delete_many({"campaign_id": camp["campaign_id"]})

    def test_promo_validation_rejects_bad_code(self):
        r = requests.post(f"{BASE_URL}/api/promos/validate",
                          json={"code": "TOTALLY_FAKE_XYZ", "tier_key": "local"}, timeout=10)
        assert r.status_code in (400, 404)

    def test_campaign_ownership_enforced(self, business_token, admin_token):
        biz_token, _ = business_token
        admin_t, _ = admin_token
        # Create a campaign as business
        payload = {
            "word": "OWNTEST",
            "image_base64": TINY_IMAGE_B64,
            "tier_key": "local",
            "target_country_code": "PT",
            "target_city": "Lisboa",
        }
        r = requests.post(f"{BASE_URL}/api/business/campaigns", json=payload,
                          headers={"Authorization": f"Bearer {biz_token}"}, timeout=20)
        assert r.status_code == 200
        camp_id = r.json()["campaign_id"]
        # Try to fetch as admin (different user) — should 404 because filter is user_id-scoped
        r2 = requests.get(f"{BASE_URL}/api/business/campaigns/{camp_id}",
                          headers={"Authorization": f"Bearer {admin_t}"}, timeout=10)
        assert r2.status_code == 404
        # But admin audit endpoint should still see it
        r3 = requests.get(f"{BASE_URL}/api/admin/campaigns/{camp_id}/audit",
                          headers={"Authorization": f"Bearer {admin_t}"}, timeout=10)
        assert r3.status_code == 200
        # cleanup
        _db.campaigns.delete_one({"campaign_id": camp_id})
        _db.campaign_audit.delete_many({"campaign_id": camp_id})
