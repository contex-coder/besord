"""Iteration 12 backend tests — Themes, Styles, Trends, Zone filter, Stripe invoicing."""
import os
import uuid
import base64
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://image-feedback-app.preview.emergentagent.com").rstrip("/")

# 1px PNG (base64) > 50 chars
PNG_1x1 = ("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAfbLI3wAA"
           "AABJRU5ErkJggg==" * 2)


# ---------- Themes ----------
class TestThemes:
    def test_list_themes_public(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/themes")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        assert len(data) == 10, f"Expected 10 themes, got {len(data)}"
        keys = {t["key"] for t in data}
        expected = {"estilo", "criar", "casa", "corpo", "prato", "cidade", "move", "tech", "natura", "vibe"}
        assert keys == expected, f"Missing keys: {expected - keys}, extras: {keys - expected}"
        for t in data:
            assert "key" in t and "name" in t and "emoji" in t and "covers" in t

    def test_create_post_with_valid_theme(self, api_client, auth_headers, seeded_user, mongo_db):
        word = f"TESTTHM{uuid.uuid4().hex[:4]}"
        payload = {"word": word, "image_base64": PNG_1x1, "theme": "estilo"}
        r = api_client.post(f"{BASE_URL}/api/posts", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        post = r.json()
        # Check DB has theme stored
        doc = mongo_db.posts.find_one({"post_id": post["post_id"]})
        assert doc is not None
        assert doc.get("theme") == "estilo", f"theme stored: {doc.get('theme')}"
        # Cleanup
        mongo_db.posts.delete_one({"post_id": post["post_id"]})

    def test_create_post_with_invalid_theme(self, api_client, auth_headers):
        payload = {"word": f"TESTBAD{uuid.uuid4().hex[:4]}", "image_base64": PNG_1x1, "theme": "bogus"}
        r = api_client.post(f"{BASE_URL}/api/posts", json=payload, headers=auth_headers)
        assert r.status_code == 400, r.text

    def test_create_post_without_theme(self, api_client, auth_headers, mongo_db):
        word = f"TESTNTH{uuid.uuid4().hex[:4]}"
        payload = {"word": word, "image_base64": PNG_1x1}
        r = api_client.post(f"{BASE_URL}/api/posts", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        post = r.json()
        doc = mongo_db.posts.find_one({"post_id": post["post_id"]})
        assert doc.get("theme") is None
        mongo_db.posts.delete_one({"post_id": post["post_id"]})

    def test_list_posts_by_theme_filter(self, api_client, auth_headers, mongo_db, seeded_user):
        # Create one estilo + one tech, fetch by theme
        w1 = f"TESTFE{uuid.uuid4().hex[:4]}"
        w2 = f"TESTFT{uuid.uuid4().hex[:4]}"
        p1 = api_client.post(f"{BASE_URL}/api/posts",
                             json={"word": w1, "image_base64": PNG_1x1, "theme": "estilo"},
                             headers=auth_headers).json()
        p2 = api_client.post(f"{BASE_URL}/api/posts",
                             json={"word": w2, "image_base64": PNG_1x1, "theme": "tech"},
                             headers=auth_headers).json()
        try:
            r = api_client.get(f"{BASE_URL}/api/posts?theme=estilo")
            assert r.status_code == 200
            posts = r.json()
            words = {p["word"] for p in posts}
            assert w1.upper() in words, f"expected {w1} in feed, got {list(words)[:5]}..."
            assert w2.upper() not in words, f"{w2} (tech) should not appear in estilo filter"
        finally:
            mongo_db.posts.delete_one({"post_id": p1["post_id"]})
            mongo_db.posts.delete_one({"post_id": p2["post_id"]})


# ---------- Styles ----------
class TestStyles:
    def test_styles_me_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/styles/me")
        assert r.status_code == 401

    def test_follow_idempotent(self, api_client, auth_headers, seeded_user, mongo_db):
        word = "TESTFOLLOWA"
        # cleanup
        mongo_db.followed_styles.delete_many({"user_id": seeded_user["user_id"], "word": word})
        r1 = api_client.post(f"{BASE_URL}/api/styles/{word}/follow", headers=auth_headers)
        r2 = api_client.post(f"{BASE_URL}/api/styles/{word}/follow", headers=auth_headers)
        assert r1.status_code == 200, r1.text
        assert r2.status_code == 200, r2.text
        count = mongo_db.followed_styles.count_documents({"user_id": seeded_user["user_id"], "word": word})
        assert count == 1, f"expected exactly 1 row, got {count}"

        # GET /api/styles/me includes it
        rme = api_client.get(f"{BASE_URL}/api/styles/me", headers=auth_headers)
        assert rme.status_code == 200
        body = rme.json()
        assert word in body["words"]
        assert any(it["word"] == word for it in body["items"])

        # status reflects following=true
        rs = api_client.get(f"{BASE_URL}/api/styles/{word}/status", headers=auth_headers)
        assert rs.status_code == 200
        sb = rs.json()
        assert sb["following"] is True
        assert sb["follower_count"] >= 1
        assert sb["word"] == word

        # unfollow
        rd = api_client.delete(f"{BASE_URL}/api/styles/{word}/follow", headers=auth_headers)
        assert rd.status_code == 200
        rs2 = api_client.get(f"{BASE_URL}/api/styles/{word}/status", headers=auth_headers)
        sb2 = rs2.json()
        assert sb2["following"] is False
        # Cleanup
        mongo_db.followed_styles.delete_many({"user_id": seeded_user["user_id"], "word": word})

    def test_styles_status_no_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/styles/SOMEWORD/status")
        assert r.status_code == 200
        body = r.json()
        assert body["following"] is False
        assert "follower_count" in body

    def test_posts_source_styles_no_auth_returns_empty(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/posts?source=styles")
        assert r.status_code == 200
        assert r.json() == []

    def test_posts_source_styles_filters_by_follows(self, api_client, auth_headers, seeded_user, mongo_db):
        # No follows -> []
        mongo_db.followed_styles.delete_many({"user_id": seeded_user["user_id"]})
        r = api_client.get(f"{BASE_URL}/api/posts?source=styles", headers=auth_headers)
        assert r.status_code == 200
        assert r.json() == []

        # Create a post, follow its word
        word = f"TESTSRC{uuid.uuid4().hex[:4]}"
        p = api_client.post(f"{BASE_URL}/api/posts",
                            json={"word": word, "image_base64": PNG_1x1},
                            headers=auth_headers).json()
        api_client.post(f"{BASE_URL}/api/styles/{word}/follow", headers=auth_headers)
        try:
            r2 = api_client.get(f"{BASE_URL}/api/posts?source=styles", headers=auth_headers)
            assert r2.status_code == 200
            posts = r2.json()
            words = {pp["word"] for pp in posts}
            assert word.upper() in words, f"followed word should appear, got {words}"
            # All returned posts must be in followed list (just {word})
            for pp in posts:
                assert pp["word"] == word.upper(), f"unexpected word {pp['word']} in styles feed"
        finally:
            mongo_db.posts.delete_one({"post_id": p["post_id"]})
            mongo_db.followed_styles.delete_many({"user_id": seeded_user["user_id"]})


# ---------- Trends ----------
class TestTrends:
    def test_trends_public_24h(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/trends?period=24h")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "items" in body
        assert isinstance(body["items"], list)
        assert body["scope"] == "world"
        assert body["period"] == "24h"

    def test_trends_scope_country(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/trends?scope=country&country_code=PT&period=7d")
        assert r.status_code == 200
        body = r.json()
        assert body["scope"] == "country"
        assert body["country_code"] == "PT"

    def test_trends_with_theme(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/trends?theme=estilo&period=30d")
        assert r.status_code == 200
        body = r.json()
        assert body["theme"] == "estilo"
        # If any items returned, they must have theme=estilo
        for it in body["items"]:
            assert it.get("theme") == "estilo", f"item {it} should have theme=estilo"

    def test_trends_aggregation_correctness(self, api_client, auth_headers, seeded_user, mongo_db):
        """Insert a vote in the last hour, verify aggregation includes the post."""
        word = f"TESTTRD{uuid.uuid4().hex[:4]}"
        p = api_client.post(f"{BASE_URL}/api/posts",
                            json={"word": word, "image_base64": PNG_1x1, "theme": "tech"},
                            headers=auth_headers).json()
        # cast a vote
        api_client.post(f"{BASE_URL}/api/posts/{p['post_id']}/vote",
                        json={"vote": "aprovo"}, headers=auth_headers)
        try:
            r = api_client.get(f"{BASE_URL}/api/trends?theme=tech&period=24h&limit=50")
            assert r.status_code == 200
            words = {it["word"] for it in r.json()["items"]}
            assert word.upper() in words, f"theme=tech trends should include {word}, got {words}"
        finally:
            mongo_db.votes.delete_many({"post_id": p["post_id"]})
            mongo_db.posts.delete_one({"post_id": p["post_id"]})


# ---------- Invoice ----------
class TestInvoice:
    def test_invoice_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/business/campaigns/somecamp/invoice")
        assert r.status_code == 401

    def test_invoice_mock_session_returns_unavailable(self, api_client, auth_headers, seeded_user, mongo_db):
        cid = f"camp_TEST_{uuid.uuid4().hex[:8]}"
        mongo_db.campaigns.insert_one({
            "campaign_id": cid,
            "user_id": seeded_user["user_id"],
            "stripe_session_id": f"cs_test_mock_{uuid.uuid4().hex[:8]}",
            "word": "TEST",
            "amount_cents": 1000,
            "status": "active",
            "created_at": datetime.now(timezone.utc),
        })
        try:
            r = api_client.get(f"{BASE_URL}/api/business/campaigns/{cid}/invoice", headers=auth_headers)
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["available"] is False
            assert "demonstra" in body.get("reason", "").lower() or "demo" in body.get("reason", "").lower() or "ainda" in body.get("reason", "").lower()
        finally:
            mongo_db.campaigns.delete_one({"campaign_id": cid})

    def test_invoice_real_session_id_reachable(self, api_client, auth_headers, seeded_user, mongo_db):
        """Use a fake real-mode sid (non-mock); endpoint should attempt Stripe call and return 502 or 200(unavail)."""
        cid = f"camp_TEST_{uuid.uuid4().hex[:8]}"
        mongo_db.campaigns.insert_one({
            "campaign_id": cid,
            "user_id": seeded_user["user_id"],
            "stripe_session_id": "cs_test_abc_nonexistent",
            "word": "TEST",
            "amount_cents": 1000,
            "status": "active",
            "created_at": datetime.now(timezone.utc),
        })
        try:
            r = api_client.get(f"{BASE_URL}/api/business/campaigns/{cid}/invoice", headers=auth_headers)
            # Either 502 Stripe error, or 200 unavailable. Just confirm route reachable.
            assert r.status_code in (200, 502), r.text
        finally:
            mongo_db.campaigns.delete_one({"campaign_id": cid})

    def test_invoice_other_user_campaign_404(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/business/campaigns/camp_nonexistent_zzz/invoice", headers=auth_headers)
        assert r.status_code == 404


# ---------- Regression ----------
class TestRegression:
    def test_get_posts_recent(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/posts")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_posts_trending(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/posts?sort=trending")
        assert r.status_code == 200

    def test_vote_and_comment(self, api_client, auth_headers, mongo_db):
        word = f"TESTRG{uuid.uuid4().hex[:4]}"
        p = api_client.post(f"{BASE_URL}/api/posts",
                            json={"word": word, "image_base64": PNG_1x1},
                            headers=auth_headers).json()
        try:
            rv = api_client.post(f"{BASE_URL}/api/posts/{p['post_id']}/vote",
                                 json={"vote": "aprovo"}, headers=auth_headers)
            assert rv.status_code == 200
            rc = api_client.post(f"{BASE_URL}/api/posts/{p['post_id']}/comment",
                                 json={"word": "FIXE"}, headers=auth_headers)
            assert rc.status_code == 200
        finally:
            mongo_db.votes.delete_many({"post_id": p["post_id"]})
            mongo_db.comments.delete_many({"post_id": p["post_id"]})
            mongo_db.posts.delete_one({"post_id": p["post_id"]})

    def test_notifications_auth_gate(self, api_client, auth_headers):
        r0 = api_client.get(f"{BASE_URL}/api/notifications")
        assert r0.status_code == 401
        r1 = api_client.get(f"{BASE_URL}/api/notifications", headers=auth_headers)
        assert r1.status_code == 200

    def test_business_dashboard_auth_gate(self, api_client, auth_headers):
        r0 = api_client.get(f"{BASE_URL}/api/business/dashboard")
        assert r0.status_code == 401
        # 200 OR 400 if no business profile; the goal is "not 401" with auth
        r1 = api_client.get(f"{BASE_URL}/api/business/dashboard", headers=auth_headers)
        assert r1.status_code in (200, 400), r1.text

    def test_download_zip(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/download/besord-site.zip")
        assert r.status_code == 200
        # Ensure binary returned (>10KB)
        assert len(r.content) > 10_000, f"zip too small: {len(r.content)} bytes"
