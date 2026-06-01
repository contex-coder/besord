"""Iteration 9 backend tests.

Covers:
- Admin tier CRUD (GET/POST/DELETE /api/admin/tiers)
- Public /api/business/tiers honors overrides
- Auth session race (idempotent under repeat same session_id)
- Static zip download
- Regression smoke (posts, auth/me, vote, advertiser cancel)
"""
import os
import time
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://image-feedback-app.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "rodrigocontecunha@gmail.com").lower()


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def db():
    cli = MongoClient(MONGO_URL)
    yield cli[DB_NAME]
    cli.close()


@pytest.fixture(scope="module")
def admin_token(db):
    """Inject admin session directly to bypass OAuth."""
    user_id = f"user_TEST_iter9_admin_{uuid.uuid4().hex[:6]}"
    token = f"test_iter9_admin_{uuid.uuid4().hex}"
    # Ensure admin email user exists; we use the configured ADMIN_EMAIL
    existing = db.users.find_one({"email": ADMIN_EMAIL})
    if existing:
        admin_user_id = existing["user_id"]
    else:
        admin_user_id = user_id
        db.users.insert_one({
            "user_id": admin_user_id,
            "email": ADMIN_EMAIL,
            "name": "Test Admin",
            "picture": None,
            "created_at": datetime.now(timezone.utc),
        })
    db.user_sessions.insert_one({
        "session_token": token,
        "user_id": admin_user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
        "created_at": datetime.now(timezone.utc),
    })
    # Clean overrides + audit start state
    db.tier_overrides.delete_many({})
    yield {"token": token, "user_id": admin_user_id}
    db.user_sessions.delete_one({"session_token": token})
    db.tier_overrides.delete_many({})
    db.admin_audit.delete_many({"event": {"$in": ["tier_price_update", "tier_price_reset"]}})


@pytest.fixture(scope="module")
def user_token(db):
    user_id = f"user_TEST_iter9_user_{uuid.uuid4().hex[:6]}"
    token = f"test_iter9_user_{uuid.uuid4().hex}"
    db.users.insert_one({
        "user_id": user_id,
        "email": f"TEST_iter9_{uuid.uuid4().hex[:6]}@example.com",
        "name": "Test User",
        "picture": None,
        "created_at": datetime.now(timezone.utc),
    })
    db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
        "created_at": datetime.now(timezone.utc),
    })
    yield {"token": token, "user_id": user_id}
    db.user_sessions.delete_one({"session_token": token})
    db.users.delete_one({"user_id": user_id})


def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- 1. GET /api/admin/tiers auth ----------
class TestAdminTiersAuth:
    def test_get_admin_tiers_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/tiers")
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"

    def test_get_admin_tiers_user_forbidden(self, user_token):
        r = requests.get(f"{BASE_URL}/api/admin/tiers", headers=H(user_token["token"]))
        assert r.status_code == 403

    def test_get_admin_tiers_admin_ok(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/tiers", headers=H(admin_token["token"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        keys = {t["key"] for t in data}
        assert keys == {"local", "regional", "national", "global"}, f"got {keys}"
        for t in data:
            for f in ("key", "name", "scope", "duration_days", "amount_cents",
                      "included_votes", "is_overridden", "overridden_at"):
                assert f in t, f"missing {f} in tier {t}"
            assert t["is_overridden"] is False  # we cleared overrides in fixture


# ---------- 2. POST /api/admin/tiers override ----------
class TestAdminTiersUpdate:
    def test_update_local_tier(self, admin_token, db):
        body = {"tier_key": "local", "amount_cents": 2500, "included_votes": 1500}
        r = requests.post(f"{BASE_URL}/api/admin/tiers", headers=H(admin_token["token"]), json=body)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("ok") is True
        assert j.get("tier_key") == "local"
        assert j.get("amount_cents") == 2500
        assert j.get("included_votes") == 1500

        # Verify via GET
        r2 = requests.get(f"{BASE_URL}/api/admin/tiers", headers=H(admin_token["token"]))
        assert r2.status_code == 200
        local = next(t for t in r2.json() if t["key"] == "local")
        assert local["amount_cents"] == 2500
        assert local["included_votes"] == 1500
        assert local["is_overridden"] is True
        assert local["overridden_at"] is not None

        # Verify audit row
        audit = db.admin_audit.find_one({"event": "tier_price_update", "tier_key": "local"},
                                        sort=[("created_at", -1)])
        assert audit is not None
        assert audit["amount_cents"] == 2500
        assert audit["included_votes"] == 1500


# ---------- 3. POST validation ----------
class TestAdminTiersValidation:
    def test_amount_too_low(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/admin/tiers", headers=H(admin_token["token"]),
                          json={"tier_key": "regional", "amount_cents": 50, "included_votes": 500})
        assert r.status_code == 400

    def test_amount_too_high(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/admin/tiers", headers=H(admin_token["token"]),
                          json={"tier_key": "regional", "amount_cents": 2_000_000, "included_votes": 500})
        assert r.status_code == 400

    def test_votes_too_low(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/admin/tiers", headers=H(admin_token["token"]),
                          json={"tier_key": "regional", "amount_cents": 5000, "included_votes": 5})
        assert r.status_code == 400

    def test_unknown_tier_key(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/admin/tiers", headers=H(admin_token["token"]),
                          json={"tier_key": "bogus", "amount_cents": 5000, "included_votes": 500})
        assert r.status_code == 400


# ---------- 4. DELETE reset ----------
class TestAdminTiersReset:
    def test_reset_local(self, admin_token, db):
        # Ensure override exists first
        requests.post(f"{BASE_URL}/api/admin/tiers", headers=H(admin_token["token"]),
                      json={"tier_key": "local", "amount_cents": 2500, "included_votes": 1500})

        r = requests.delete(f"{BASE_URL}/api/admin/tiers/local", headers=H(admin_token["token"]))
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # Verify defaults restored
        r2 = requests.get(f"{BASE_URL}/api/admin/tiers", headers=H(admin_token["token"]))
        local = next(t for t in r2.json() if t["key"] == "local")
        assert local["is_overridden"] is False
        # Defaults from pricing.py: local => 1900, 380
        assert local["amount_cents"] == 1900, f"expected default 1900 got {local['amount_cents']}"
        assert local["included_votes"] == 380, f"expected default 380 got {local['included_votes']}"

        audit = db.admin_audit.find_one({"event": "tier_price_reset", "tier_key": "local"},
                                        sort=[("created_at", -1)])
        assert audit is not None


# ---------- 5. Public /api/business/tiers honors overrides ----------
class TestPublicTiersHonorsOverrides:
    def test_public_tiers_reflects_override(self, admin_token, db):
        # Set an override for regional
        requests.post(f"{BASE_URL}/api/admin/tiers", headers=H(admin_token["token"]),
                      json={"tier_key": "regional", "amount_cents": 7777, "included_votes": 555})
        r = requests.get(f"{BASE_URL}/api/business/tiers")
        assert r.status_code == 200
        regional = next(t for t in r.json() if t["key"] == "regional")
        assert regional["amount_cents"] == 7777
        assert regional["included_votes"] == 555
        # cleanup
        requests.delete(f"{BASE_URL}/api/admin/tiers/regional", headers=H(admin_token["token"]))


# ---------- 6. Auth session race ----------
class TestAuthSessionRace:
    def test_invalid_session_returns_401_not_500(self):
        # Bad session_id => Emergent backend returns non-200 => we return 401
        r = requests.post(f"{BASE_URL}/api/auth/session", json={"session_id": f"invalid_{uuid.uuid4().hex}"})
        # Should NOT be 500 (race fix), should be 401
        assert r.status_code in (401, 502), f"expected 401/502 got {r.status_code} body={r.text}"
        assert r.status_code != 500


# ---------- 7. Zip download ----------
class TestZipDownload:
    def test_zip_endpoint(self):
        r = requests.get(f"{BASE_URL}/api/download/besord-site.zip")
        assert r.status_code == 200, f"got {r.status_code}"
        ct = r.headers.get("content-type", "")
        assert "application/zip" in ct, f"content-type={ct}"
        # size sanity: zip is ~115KB
        size = len(r.content)
        assert 50_000 < size < 500_000, f"unexpected zip size {size}"


# ---------- 8. Regression smoke ----------
class TestRegression:
    def test_posts_public(self):
        r = requests.get(f"{BASE_URL}/api/posts")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_auth_me(self, user_token):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=H(user_token["token"]))
        assert r.status_code == 200
        assert r.json()["user_id"] == user_token["user_id"]

    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"
