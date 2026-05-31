"""Iteration 7 — Phase B compliance & security tests.

Covers:
A. Moderation (unit + endpoint integration)
B. Age gate (server-side enforcement)
C. Stripe webhook (signature & 503 guard)
D. Admin moderation queue
E. Regression on core endpoints
"""
import os
import sys
import base64
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

# Allow `from moderation import check_word`
sys.path.insert(0, "/app/backend")

from moderation import check_word  # noqa: E402

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://image-feedback-app.preview.emergentagent.com").rstrip("/")

# A small valid base64 image (>= 50 chars)
TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
)


# ---------------------------------------------------------------------------
# Fixtures: seed an authenticated user and an admin user via direct DB writes
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def seed_users(mongo_db):
    user_id = f"user_TEST_iter7_{uuid.uuid4().hex[:8]}"
    token = f"tok_TEST_iter7_{uuid.uuid4().hex[:16]}"
    admin_user_id = f"user_TEST_iter7_admin_{uuid.uuid4().hex[:8]}"
    admin_token = f"tok_TEST_iter7_admin_{uuid.uuid4().hex[:16]}"

    admin_email = os.environ.get("ADMIN_EMAIL", "rodrigocontecunha@gmail.com").lower()

    mongo_db.users.delete_many({"user_id": {"$in": [user_id, admin_user_id]}})
    mongo_db.user_sessions.delete_many({"session_token": {"$in": [token, admin_token]}})

    mongo_db.users.insert_one({
        "user_id": user_id,
        "email": f"TEST_iter7_{uuid.uuid4().hex[:6]}@example.com",
        "name": "TEST Iter7 User",
        "age_confirmed_at": datetime.now(timezone.utc),
        "birth_year": 1990,
        "created_at": datetime.now(timezone.utc),
    })
    mongo_db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })

    # Ensure there's a doc with the admin email and our token. The actual
    # admin email may already exist; we update or insert it.
    existing_admin = mongo_db.users.find_one({"email": admin_email})
    if existing_admin:
        admin_user_id = existing_admin["user_id"]
    else:
        mongo_db.users.insert_one({
            "user_id": admin_user_id,
            "email": admin_email,
            "name": "TEST Admin",
            "age_confirmed_at": datetime.now(timezone.utc),
            "birth_year": 1985,
            "created_at": datetime.now(timezone.utc),
        })
    mongo_db.user_sessions.insert_one({
        "session_token": admin_token,
        "user_id": admin_user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })

    # Add a business profile to user so campaigns endpoint can be tested
    mongo_db.users.update_one(
        {"user_id": user_id},
        {"$set": {"business_profile": {
            "company_name": "TEST Co", "country": "Portugal", "country_code": "PT",
            "contact_email": "TEST@example.com", "contact_name": "Tester",
        }}},
    )

    yield {
        "user_id": user_id,
        "token": token,
        "admin_user_id": admin_user_id,
        "admin_token": admin_token,
    }

    # Teardown
    mongo_db.user_sessions.delete_many({"session_token": {"$in": [token, admin_token]}})
    mongo_db.users.delete_many({"user_id": user_id})
    mongo_db.posts.delete_many({"author_id": user_id})
    mongo_db.votes.delete_many({"user_id": user_id})
    mongo_db.comments.delete_many({"user_id": user_id})


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ===========================================================================
# A. MODERATION — unit + endpoint
# ===========================================================================
class TestModerationUnit:
    @pytest.mark.parametrize("word", ["PIZZA", "design", "lançamento", "child", "matar", "campeoes", "PROJETO"])
    def test_allowed_words(self, word):
        ok, reason = check_word(word)
        assert ok, f"expected ok for {word!r} got reason={reason!r}"

    @pytest.mark.parametrize("word", ["fdp", "FDP", "puta", "PuTaRiA", "PORNOOO", "NIGGER", "pedofilo", "rape"])
    def test_blocked_words(self, word):
        ok, reason = check_word(word)
        assert not ok, f"expected blocked for {word!r}"
        assert reason and "comunidade" in reason


class TestModerationEndpoints:
    def test_post_create_blocked_word(self, seed_users):
        # First create a post we can comment on (with a clean word)
        post_resp = requests.post(
            f"{BASE_URL}/api/posts",
            json={"word": "DESIGN", "image_base64": TINY_PNG_B64 + "a" * 60},
            headers=_hdr(seed_users["token"]),
            timeout=30,
        )
        assert post_resp.status_code == 200, post_resp.text
        post_id = post_resp.json()["post_id"]

        # Now comment "fdp" -> 400
        r = requests.post(
            f"{BASE_URL}/api/posts/{post_id}/comment",
            json={"word": "fdp"},
            headers=_hdr(seed_users["token"]),
            timeout=30,
        )
        assert r.status_code == 400, r.text
        assert "comunidade" in r.json().get("detail", "")

    def test_post_create_with_blocked_word(self, seed_users):
        r = requests.post(
            f"{BASE_URL}/api/posts",
            json={"word": "puta", "image_base64": TINY_PNG_B64 + "a" * 60},
            headers=_hdr(seed_users["token"]),
            timeout=30,
        )
        assert r.status_code == 400, r.text
        assert "comunidade" in r.json().get("detail", "")

    def test_campaign_blocked_word(self, seed_users):
        r = requests.post(
            f"{BASE_URL}/api/business/campaigns",
            json={
                "word": "rape", "image_base64": TINY_PNG_B64 + "a" * 60,
                "tier_key": "local", "target_country_code": "PT", "target_city": "Lisboa",
            },
            headers=_hdr(seed_users["token"]),
            timeout=30,
        )
        assert r.status_code == 400, r.text
        assert "comunidade" in r.json().get("detail", "")

    def test_post_clean_word_allowed(self, seed_users):
        r = requests.post(
            f"{BASE_URL}/api/posts",
            json={"word": "design", "image_base64": TINY_PNG_B64 + "a" * 60},
            headers=_hdr(seed_users["token"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text


# ===========================================================================
# B. AGE GATE
# ===========================================================================
class TestAgeGate:
    def test_no_auth_returns_401(self):
        r = requests.post(f"{BASE_URL}/api/auth/confirm-age", json={"birth_year": 1990}, timeout=15)
        assert r.status_code == 401, r.text

    def test_underage_blocks_and_kills_sessions(self, mongo_db):
        # Create a dedicated user/session for this destructive test
        uid = f"user_TEST_underage_{uuid.uuid4().hex[:8]}"
        tok = f"tok_TEST_underage_{uuid.uuid4().hex[:16]}"
        mongo_db.users.insert_one({
            "user_id": uid, "email": f"TEST_under_{uuid.uuid4().hex[:6]}@example.com",
            "name": "Underage", "created_at": datetime.now(timezone.utc),
        })
        mongo_db.user_sessions.insert_one({
            "session_token": tok, "user_id": uid,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc),
        })
        try:
            r = requests.post(
                f"{BASE_URL}/api/auth/confirm-age", json={"birth_year": 2020},
                headers=_hdr(tok), timeout=15,
            )
            assert r.status_code == 403, r.text
            assert "13" in r.json().get("detail", "")
            # Old token should now be invalid
            me = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(tok), timeout=15)
            assert me.status_code == 401
        finally:
            mongo_db.user_sessions.delete_many({"user_id": uid})
            mongo_db.users.delete_one({"user_id": uid})

    def test_valid_birth_year_success(self, mongo_db):
        uid = f"user_TEST_adult_{uuid.uuid4().hex[:8]}"
        tok = f"tok_TEST_adult_{uuid.uuid4().hex[:16]}"
        mongo_db.users.insert_one({
            "user_id": uid, "email": f"TEST_adult_{uuid.uuid4().hex[:6]}@example.com",
            "name": "Adult", "created_at": datetime.now(timezone.utc),
        })
        mongo_db.user_sessions.insert_one({
            "session_token": tok, "user_id": uid,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc),
        })
        try:
            r = requests.post(
                f"{BASE_URL}/api/auth/confirm-age", json={"birth_year": 1990},
                headers=_hdr(tok), timeout=15,
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["age_confirmed"] is True
            assert data["birth_year"] == 1990
            # Idempotent
            r2 = requests.post(
                f"{BASE_URL}/api/auth/confirm-age", json={"birth_year": 1990},
                headers=_hdr(tok), timeout=15,
            )
            assert r2.status_code == 200
        finally:
            mongo_db.user_sessions.delete_many({"user_id": uid})
            mongo_db.users.delete_one({"user_id": uid})

    @pytest.mark.parametrize("year", [1700, 3000])
    def test_invalid_birth_year(self, seed_users, year):
        r = requests.post(
            f"{BASE_URL}/api/auth/confirm-age", json={"birth_year": year},
            headers=_hdr(seed_users["token"]), timeout=15,
        )
        assert r.status_code == 400, r.text


# ===========================================================================
# C. STRIPE WEBHOOK
# ===========================================================================
class TestStripeWebhook:
    def test_secret_missing_returns_503(self):
        # STRIPE_WEBHOOK_SECRET is empty in current env
        r = requests.post(
            f"{BASE_URL}/api/stripe/webhook",
            data=b'{"id":"evt_test"}',
            headers={"Content-Type": "application/json", "Stripe-Signature": "t=0,v1=bad"},
            timeout=15,
        )
        # If secret is set somehow, accept 400 (invalid signature) as also valid
        assert r.status_code in (503, 400), r.text

    def test_route_exists(self):
        r = requests.options(f"{BASE_URL}/api/stripe/webhook", timeout=10)
        # Route exists if not 404
        assert r.status_code != 404


# ===========================================================================
# D. ADMIN MODERATION QUEUE
# ===========================================================================
class TestAdminModeration:
    def test_queue_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/moderation/queue", timeout=15)
        assert r.status_code == 401

    def test_queue_admin_ok(self, seed_users):
        r = requests.get(
            f"{BASE_URL}/api/admin/moderation/queue",
            headers=_hdr(seed_users["admin_token"]), timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "items" in body and "count" in body

    @pytest.mark.parametrize("status", ["pending", "hidden", "all"])
    def test_queue_filters(self, seed_users, status):
        r = requests.get(
            f"{BASE_URL}/api/admin/moderation/queue?status={status}",
            headers=_hdr(seed_users["admin_token"]), timeout=15,
        )
        assert r.status_code == 200, r.text

    def test_hide_restore_delete_flow(self, seed_users, mongo_db):
        # Create a temp post owned by our user
        r = requests.post(
            f"{BASE_URL}/api/posts",
            json={"word": "TESTMOD", "image_base64": TINY_PNG_B64 + "a" * 60},
            headers=_hdr(seed_users["token"]), timeout=30,
        )
        assert r.status_code == 200, r.text
        post_id = r.json()["post_id"]

        # Hide
        r = requests.post(
            f"{BASE_URL}/api/admin/moderation/post/{post_id}",
            json={"action": "hide"},
            headers=_hdr(seed_users["admin_token"]), timeout=15,
        )
        assert r.status_code == 200, r.text
        doc = mongo_db.posts.find_one({"post_id": post_id})
        assert doc and doc.get("hidden") is True

        # Restore
        r = requests.post(
            f"{BASE_URL}/api/admin/moderation/post/{post_id}",
            json={"action": "restore"},
            headers=_hdr(seed_users["admin_token"]), timeout=15,
        )
        assert r.status_code == 200
        doc = mongo_db.posts.find_one({"post_id": post_id})
        assert doc.get("hidden") is False
        assert doc.get("reports_count", 0) == 0

        # Delete
        r = requests.post(
            f"{BASE_URL}/api/admin/moderation/post/{post_id}",
            json={"action": "delete"},
            headers=_hdr(seed_users["admin_token"]), timeout=15,
        )
        assert r.status_code == 200
        assert mongo_db.posts.find_one({"post_id": post_id}) is None

    def test_invalid_action(self, seed_users, mongo_db):
        r = requests.post(
            f"{BASE_URL}/api/posts",
            json={"word": "TESTBAD", "image_base64": TINY_PNG_B64 + "a" * 60},
            headers=_hdr(seed_users["token"]), timeout=30,
        )
        assert r.status_code == 200
        pid = r.json()["post_id"]
        try:
            r = requests.post(
                f"{BASE_URL}/api/admin/moderation/post/{pid}",
                json={"action": "invalid"},
                headers=_hdr(seed_users["admin_token"]), timeout=15,
            )
            assert r.status_code == 400
        finally:
            mongo_db.posts.delete_one({"post_id": pid})


# ===========================================================================
# E. REGRESSION
# ===========================================================================
class TestRegression:
    def test_get_posts(self):
        r = requests.get(f"{BASE_URL}/api/posts", timeout=20)
        assert r.status_code == 200

    def test_get_tiers(self):
        r = requests.get(f"{BASE_URL}/api/business/tiers", timeout=15)
        assert r.status_code == 200

    def test_auth_me(self, seed_users):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(seed_users["token"]), timeout=15)
        assert r.status_code == 200

    def test_vote(self, seed_users):
        # Create a post then vote on it
        p = requests.post(
            f"{BASE_URL}/api/posts",
            json={"word": "VOTEREG", "image_base64": TINY_PNG_B64 + "a" * 60},
            headers=_hdr(seed_users["token"]), timeout=30,
        )
        assert p.status_code == 200
        pid = p.json()["post_id"]
        r = requests.post(
            f"{BASE_URL}/api/posts/{pid}/vote",
            json={"vote": "aprovo"},
            headers=_hdr(seed_users["token"]), timeout=15,
        )
        assert r.status_code == 200
