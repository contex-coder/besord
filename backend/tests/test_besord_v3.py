"""Iteration 3 backend tests for Besord — Real Stripe key, promo codes, whoami, admin gating, post deletion rules."""
import base64
import uuid
from datetime import datetime, timezone, timedelta

import pytest


_PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")
DUMMY_IMG = "data:image/png;base64," + base64.b64encode(_PNG).decode() + ("A" * 100)

ADMIN_EMAIL = "rodrigocontecunha@gmail.com"
ADMIN_USER_ID = "user_admin_rodrigo"
ADMIN_TOKEN = "admin_test_token_for_rodrigo_xyz123"


# ---------- Admin user seed fixture ----------
@pytest.fixture(scope="module")
def admin_seed(mongo_db):
    """Create admin user + session (idempotent reuse)."""
    mongo_db.users.delete_many({"user_id": ADMIN_USER_ID})
    mongo_db.users.delete_many({"email": ADMIN_EMAIL})
    mongo_db.user_sessions.delete_many({"session_token": ADMIN_TOKEN})

    mongo_db.users.insert_one({
        "user_id": ADMIN_USER_ID,
        "email": ADMIN_EMAIL,
        "name": "Rodrigo Cunha",
        "picture": None,
        "created_at": datetime.now(timezone.utc),
        "business_profile": {
            "company_name": "TEST_Admin Co", "country": "Portugal", "country_code": "PT",
            "tax_id": "PT123", "contact_email": ADMIN_EMAIL, "contact_name": "Rodrigo",
            "created_at": datetime.now(timezone.utc),
        },
    })
    mongo_db.user_sessions.insert_one({
        "session_token": ADMIN_TOKEN,
        "user_id": ADMIN_USER_ID,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    yield {"user_id": ADMIN_USER_ID, "token": ADMIN_TOKEN, "email": ADMIN_EMAIL}
    mongo_db.users.delete_many({"user_id": ADMIN_USER_ID})
    mongo_db.user_sessions.delete_many({"session_token": ADMIN_TOKEN})
    mongo_db.campaigns.delete_many({"user_id": ADMIN_USER_ID})
    mongo_db.posts.delete_many({"author_id": ADMIN_USER_ID})


@pytest.fixture
def admin_headers(admin_seed):
    return {"Authorization": f"Bearer {admin_seed['token']}", "Content-Type": "application/json"}


# ---------- Promo seeding (must run before promo/campaign tests) ----------
@pytest.fixture(scope="module", autouse=True)
def seed_promo_codes(mongo_db):
    """Pre-seed LANCAMENTO50 (50%) and WELCOME20 (20%) idempotently."""
    promos = [
        {"code": "LANCAMENTO50", "discount_pct": 50, "max_uses": None, "uses": 0,
         "expires_at": None, "active": True, "created_at": datetime.now(timezone.utc)},
        {"code": "WELCOME20", "discount_pct": 20, "max_uses": None, "uses": 0,
         "expires_at": None, "active": True, "created_at": datetime.now(timezone.utc)},
    ]
    for p in promos:
        mongo_db.promo_codes.update_one({"code": p["code"]}, {"$set": p}, upsert=True)
    yield
    # don't remove; main app may rely on them


# ---------- Whoami ----------
class TestWhoAmI:
    def test_unauth(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/auth/whoami")
        assert r.status_code == 200
        body = r.json()
        assert body["authenticated"] is False
        assert body.get("admin_email_configured") is True

    def test_regular_user(self, api_client, base_url, auth_headers, seeded_user):
        r = api_client.get(f"{base_url}/api/auth/whoami", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["authenticated"] is True
        assert body["is_admin"] is False
        assert body["matches_admin"] is False
        assert body["admin_email_configured"] == ADMIN_EMAIL

    def test_admin_user(self, api_client, base_url, admin_headers):
        r = api_client.get(f"{base_url}/api/auth/whoami", headers=admin_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["authenticated"] is True
        assert body["is_admin"] is True
        assert body["matches_admin"] is True
        assert body["email"].lower() == ADMIN_EMAIL


# ---------- Promo validation ----------
class TestPromoValidate:
    def test_valid_50_off(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/promos/validate", json={"code": "LANCAMENTO50", "tier_key": "local"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["valid"] is True
        assert body["discount_pct"] == 50
        assert body["original_cents"] == 1900
        assert body["final_cents"] == 950

    def test_valid_20_off_regional(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/promos/validate", json={"code": "WELCOME20", "tier_key": "regional"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["discount_pct"] == 20
        assert body["original_cents"] == 4900
        assert body["final_cents"] == 3920  # 4900 * 0.80

    def test_invalid_code_404(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/promos/validate", json={"code": "NOPE_DOESNT_EXIST", "tier_key": "local"})
        assert r.status_code == 404

    def test_invalid_tier_400(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/promos/validate", json={"code": "LANCAMENTO50", "tier_key": "ultra_mega"})
        assert r.status_code == 400

    def test_case_insensitive(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/promos/validate", json={"code": "lancamento50", "tier_key": "local"})
        assert r.status_code == 200
        assert r.json()["code"] == "LANCAMENTO50"


# ---------- Real Stripe Campaign Creation ----------
class TestStripeRealCheckout:
    """Verify the configured sk_test_... key actually hits Stripe and returns a real checkout URL."""

    def test_create_global_real_stripe_session(self, api_client, base_url, admin_headers, mongo_db):
        # Admin user has business profile already
        r = api_client.post(f"{base_url}/api/business/campaigns", json={
            "word": "RealStripe", "image_base64": DUMMY_IMG, "tier_key": "global",
        }, headers=admin_headers)
        assert r.status_code == 200, f"Expected 200 with real Stripe key, got {r.status_code}: {r.text}"
        c = r.json()
        assert c["status"] == "pending_payment"
        assert c["amount_cents"] == 49900
        url = c.get("checkout_url") or ""
        assert url.startswith("https://checkout.stripe.com/"), f"Expected real Stripe URL, got: {url}"
        TestStripeRealCheckout.campaign_id = c["campaign_id"]

        # Confirm session_id stored is real Stripe session (starts with cs_test_)
        doc = mongo_db.campaigns.find_one({"campaign_id": c["campaign_id"]})
        sid = doc.get("stripe_session_id") or ""
        assert sid.startswith("cs_test_") and "mock" not in sid, f"Expected real Stripe session id, got: {sid}"

    def test_check_payment_pending_does_not_crash(self, api_client, base_url, admin_headers):
        cid = getattr(TestStripeRealCheckout, "campaign_id", None)
        if not cid:
            pytest.skip("No campaign created")
        r = api_client.post(f"{base_url}/api/business/campaigns/{cid}/check-payment", headers=admin_headers)
        assert r.status_code == 200, r.text
        # Since no real payment happened, must remain pending_payment (not auto-active)
        c = r.json()
        assert c["status"] == "pending_payment", f"Expected pending, got {c['status']}"

    def test_create_local_with_promo_50(self, api_client, base_url, admin_headers, mongo_db):
        r = api_client.post(f"{base_url}/api/business/campaigns", json={
            "word": "PromoTest", "image_base64": DUMMY_IMG, "tier_key": "local",
            "target_country_code": "PT", "target_city": "Lisboa",
            "promo_code": "LANCAMENTO50",
        }, headers=admin_headers)
        assert r.status_code == 200, r.text
        c = r.json()
        # 1900 * 50% = 950
        assert c["amount_cents"] == 950, f"Expected 950 cents, got {c['amount_cents']}"
        assert c["status"] == "pending_payment"
        url = c.get("checkout_url") or ""
        assert url.startswith("https://checkout.stripe.com/")
        # DB recorded promo
        doc = mongo_db.campaigns.find_one({"campaign_id": c["campaign_id"]})
        assert doc.get("promo", {}).get("code") == "LANCAMENTO50"
        assert doc.get("promo", {}).get("discount_pct") == 50
        assert doc.get("base_amount_cents") == 1900

    def test_create_with_invalid_promo_400(self, api_client, base_url, admin_headers):
        r = api_client.post(f"{base_url}/api/business/campaigns", json={
            "word": "BadPromo", "image_base64": DUMMY_IMG, "tier_key": "global",
            "promo_code": "DOES_NOT_EXIST_XYZ",
        }, headers=admin_headers)
        assert r.status_code == 400, r.text


# ---------- Admin gating ----------
class TestAdminGating:
    def test_overview_admin_200(self, api_client, base_url, admin_headers):
        r = api_client.get(f"{base_url}/api/admin/overview", headers=admin_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "users_total" in body
        assert "stripe_mode" in body
        # Real test key should report TEST mode
        assert body["stripe_mode"] == "TEST", f"Stripe mode should be TEST, got {body['stripe_mode']}"

    def test_overview_non_admin_403(self, api_client, base_url, auth_headers):
        r = api_client.get(f"{base_url}/api/admin/overview", headers=auth_headers)
        assert r.status_code == 403

    def test_overview_unauth_401(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/admin/overview")
        assert r.status_code == 401

    def test_advertisers_gated(self, api_client, base_url, auth_headers, admin_headers):
        assert api_client.get(f"{base_url}/api/admin/advertisers", headers=auth_headers).status_code == 403
        assert api_client.get(f"{base_url}/api/admin/advertisers", headers=admin_headers).status_code == 200

    def test_campaigns_admin_gated(self, api_client, base_url, auth_headers, admin_headers):
        assert api_client.get(f"{base_url}/api/admin/campaigns", headers=auth_headers).status_code == 403
        assert api_client.get(f"{base_url}/api/admin/campaigns", headers=admin_headers).status_code == 200

    def test_promos_admin_gated(self, api_client, base_url, auth_headers, admin_headers):
        assert api_client.get(f"{base_url}/api/admin/promos", headers=auth_headers).status_code == 403
        r = api_client.get(f"{base_url}/api/admin/promos", headers=admin_headers)
        assert r.status_code == 200
        codes = [p["code"] for p in r.json()]
        assert "LANCAMENTO50" in codes
        assert "WELCOME20" in codes

    def test_admin_create_and_delete_promo(self, api_client, base_url, admin_headers):
        code = f"TEST_{uuid.uuid4().hex[:6].upper()}"
        r = api_client.post(f"{base_url}/api/admin/promos", json={
            "code": code, "discount_pct": 30,
        }, headers=admin_headers)
        assert r.status_code == 200
        # Validate it
        r2 = api_client.post(f"{base_url}/api/promos/validate", json={"code": code, "tier_key": "local"})
        assert r2.status_code == 200
        assert r2.json()["discount_pct"] == 30
        # Delete it
        r3 = api_client.delete(f"{base_url}/api/admin/promos/{code}", headers=admin_headers)
        assert r3.status_code == 200
        # Now invalid
        r4 = api_client.post(f"{base_url}/api/promos/validate", json={"code": code, "tier_key": "local"})
        assert r4.status_code == 404


# ---------- Post deletion rules ----------
class TestPostDelete:
    def test_owner_can_delete_organic(self, api_client, base_url, auth_headers, seeded_user, mongo_db):
        r = api_client.post(f"{base_url}/api/posts", json={"word": "DelMe", "image_base64": DUMMY_IMG}, headers=auth_headers)
        assert r.status_code == 200
        pid = r.json()["post_id"]
        rd = api_client.delete(f"{base_url}/api/posts/{pid}", headers=auth_headers)
        assert rd.status_code == 200
        # Confirm it's gone
        doc = mongo_db.posts.find_one({"post_id": pid})
        assert doc is None

    def test_non_owner_cannot_delete(self, api_client, base_url, auth_headers, admin_headers):
        # Admin creates a post, regular user tries to delete
        r = api_client.post(f"{base_url}/api/posts", json={"word": "AdminPost", "image_base64": DUMMY_IMG}, headers=admin_headers)
        assert r.status_code == 200
        pid = r.json()["post_id"]
        try:
            rd = api_client.delete(f"{base_url}/api/posts/{pid}", headers=auth_headers)
            assert rd.status_code == 403
        finally:
            api_client.delete(f"{base_url}/api/posts/{pid}", headers=admin_headers)

    def test_sponsored_cannot_be_deleted(self, api_client, base_url, auth_headers, seeded_user, mongo_db):
        pid = f"post_TEST_spon_{uuid.uuid4().hex[:8]}"
        cid = f"camp_TEST_{uuid.uuid4().hex[:8]}"
        mongo_db.posts.insert_one({
            "post_id": pid, "word": "SPON", "image_base64": DUMMY_IMG,
            "author_id": seeded_user["user_id"], "author_name": "T", "author_picture": None,
            "created_at": datetime.now(timezone.utc),
            "aprovo_count": 0, "desaprovo_count": 0, "comments_count": 0,
            "reports_count": 0, "hidden": False, "is_sponsored": True, "campaign_id": cid,
        })
        try:
            rd = api_client.delete(f"{base_url}/api/posts/{pid}", headers=auth_headers)
            assert rd.status_code == 400, rd.text
            assert "patrocinado" in rd.json().get("detail", "").lower()
        finally:
            mongo_db.posts.delete_one({"post_id": pid})

    def test_delete_nonexistent_404(self, api_client, base_url, auth_headers):
        r = api_client.delete(f"{base_url}/api/posts/post_does_not_exist", headers=auth_headers)
        assert r.status_code == 404


# ---------- Word filter / trending sort regression ----------
class TestFeedFiltersRegression:
    def test_word_filter(self, api_client, base_url, auth_headers, mongo_db, seeded_user):
        unique = f"UNIQ{uuid.uuid4().hex[:6].upper()}"
        r = api_client.post(f"{base_url}/api/posts", json={"word": unique, "image_base64": DUMMY_IMG}, headers=auth_headers)
        assert r.status_code == 200
        pid = r.json()["post_id"]
        try:
            r2 = api_client.get(f"{base_url}/api/posts?word={unique}")
            assert r2.status_code == 200
            posts = r2.json()
            assert all(p["word"] == unique for p in posts)
            assert any(p["post_id"] == pid for p in posts)
        finally:
            api_client.delete(f"{base_url}/api/posts/{pid}", headers=auth_headers)

    def test_trending_sort_works(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/posts?sort=trending")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
