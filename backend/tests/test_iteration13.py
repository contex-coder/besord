"""Iteration 13 backend tests — BW Wallet (Best Word XP) + Styles-filtered feed regression."""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://image-feedback-app.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

PNG_1x1 = ("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAfbLI3wAA"
           "AABJRU5ErkJggg==" * 2)


# ---------------------------------------------------------------------------
# Helper — create a second voter user (separate from seeded_user the post author)
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def voter_user(mongo_db):
    uid = f"user_voter_iter13_{uuid.uuid4().hex[:6]}"
    tok = f"token_voter_iter13_{uuid.uuid4().hex[:10]}"
    mongo_db.users.insert_one({
        "user_id": uid,
        "email": f"TEST_voter_{uid}@example.com",
        "name": "Voter Test",
        "picture": None,
        "bw_balance": 0,
        "bw_total_earned": 0,
        "created_at": datetime.now(timezone.utc),
    })
    mongo_db.user_sessions.insert_one({
        "session_token": tok,
        "user_id": uid,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    yield {"user_id": uid, "session_token": tok}
    # cleanup
    mongo_db.users.delete_many({"user_id": uid})
    mongo_db.user_sessions.delete_many({"session_token": tok})
    mongo_db.bw_transactions.delete_many({"user_id": uid})
    mongo_db.votes.delete_many({"user_id": uid})


@pytest.fixture
def voter_headers(voter_user):
    return {"Authorization": f"Bearer {voter_user['session_token']}", "Content-Type": "application/json"}


def _reset_voter_wallet(mongo_db, voter_user):
    mongo_db.users.update_one({"user_id": voter_user["user_id"]},
                              {"$set": {"bw_balance": 0, "bw_total_earned": 0}})
    mongo_db.bw_transactions.delete_many({"user_id": voter_user["user_id"]})


# ---------------------------------------------------------------------------
# A. BW Wallet
# ---------------------------------------------------------------------------
class TestWallet:
    def test_wallet_me_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/wallet/me")
        assert r.status_code == 401, r.text

    def test_wallet_me_new_user_shape(self, api_client, voter_headers, voter_user, mongo_db):
        _reset_voter_wallet(mongo_db, voter_user)
        r = api_client.get(f"{BASE_URL}/api/wallet/me", headers=voter_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("balance", "total_earned", "total_spent", "transactions"):
            assert k in body, f"missing key {k}: {body}"
        assert body["balance"] == 0
        assert body["total_earned"] == 0
        assert body["total_spent"] == 0
        assert body["transactions"] == []

    def test_vote_on_other_post_awards_bw(self, api_client, auth_headers, voter_headers,
                                          voter_user, seeded_user, mongo_db):
        """Voter votes on a post not authored by them → balance +1, +1 tx row."""
        _reset_voter_wallet(mongo_db, voter_user)
        word = f"TESTBWA{uuid.uuid4().hex[:4]}"
        # seeded_user creates the post (author = seeded_user)
        p = api_client.post(f"{BASE_URL}/api/posts",
                            json={"word": word, "image_base64": PNG_1x1},
                            headers=auth_headers).json()
        try:
            assert p.get("author_id") == seeded_user["user_id"], f"post author mismatch: {p}"
            rv = api_client.post(f"{BASE_URL}/api/posts/{p['post_id']}/vote",
                                 json={"vote": "aprovo"}, headers=voter_headers)
            assert rv.status_code == 200, rv.text

            w = api_client.get(f"{BASE_URL}/api/wallet/me", headers=voter_headers).json()
            assert w["balance"] == 1, f"balance: {w}"
            assert w["total_earned"] == 1, f"earned: {w}"
            assert w["total_spent"] == 0
            assert len(w["transactions"]) == 1
            tx = w["transactions"][0]
            assert tx["delta"] == 1
            assert tx["reason"] == "vote_cast"
            assert tx["post_id"] == p["post_id"]
            assert tx["user_id"] == voter_user["user_id"]
            assert "tx_id" in tx and tx["tx_id"].startswith("bw_")
        finally:
            mongo_db.votes.delete_many({"post_id": p["post_id"]})
            mongo_db.posts.delete_one({"post_id": p["post_id"]})

    def test_vote_update_does_not_award_bw(self, api_client, auth_headers, voter_headers,
                                           voter_user, mongo_db):
        """aprovo → desaprovo on same post: no new BW."""
        _reset_voter_wallet(mongo_db, voter_user)
        word = f"TESTBWB{uuid.uuid4().hex[:4]}"
        p = api_client.post(f"{BASE_URL}/api/posts",
                            json={"word": word, "image_base64": PNG_1x1},
                            headers=auth_headers).json()
        try:
            r1 = api_client.post(f"{BASE_URL}/api/posts/{p['post_id']}/vote",
                                 json={"vote": "aprovo"}, headers=voter_headers)
            assert r1.status_code == 200
            w1 = api_client.get(f"{BASE_URL}/api/wallet/me", headers=voter_headers).json()
            assert w1["balance"] == 1
            assert w1["total_earned"] == 1
            tx_count_before = len(w1["transactions"])

            # Change vote → no new BW
            r2 = api_client.post(f"{BASE_URL}/api/posts/{p['post_id']}/vote",
                                 json={"vote": "desaprovo"}, headers=voter_headers)
            assert r2.status_code == 200
            w2 = api_client.get(f"{BASE_URL}/api/wallet/me", headers=voter_headers).json()
            assert w2["balance"] == 1, f"balance changed after vote update: {w2}"
            assert w2["total_earned"] == 1
            assert len(w2["transactions"]) == tx_count_before
        finally:
            mongo_db.votes.delete_many({"post_id": p["post_id"]})
            mongo_db.posts.delete_one({"post_id": p["post_id"]})

    def test_vote_undo_does_not_award_bw(self, api_client, auth_headers, voter_headers,
                                         voter_user, mongo_db):
        """Same vote clicked again (undo): no BW change."""
        _reset_voter_wallet(mongo_db, voter_user)
        word = f"TESTBWC{uuid.uuid4().hex[:4]}"
        p = api_client.post(f"{BASE_URL}/api/posts",
                            json={"word": word, "image_base64": PNG_1x1},
                            headers=auth_headers).json()
        try:
            api_client.post(f"{BASE_URL}/api/posts/{p['post_id']}/vote",
                            json={"vote": "aprovo"}, headers=voter_headers)
            w1 = api_client.get(f"{BASE_URL}/api/wallet/me", headers=voter_headers).json()
            assert w1["balance"] == 1
            # Click same vote → undo
            r2 = api_client.post(f"{BASE_URL}/api/posts/{p['post_id']}/vote",
                                 json={"vote": "aprovo"}, headers=voter_headers)
            assert r2.status_code == 200
            w2 = api_client.get(f"{BASE_URL}/api/wallet/me", headers=voter_headers).json()
            assert w2["balance"] == 1, f"balance changed on undo: {w2}"
            assert w2["total_earned"] == 1
            assert len(w2["transactions"]) == len(w1["transactions"])
        finally:
            mongo_db.votes.delete_many({"post_id": p["post_id"]})
            mongo_db.posts.delete_one({"post_id": p["post_id"]})

    def test_self_vote_does_not_award_bw(self, api_client, voter_headers, voter_user, mongo_db):
        """Author votes on their own post → no BW (anti-fraud)."""
        _reset_voter_wallet(mongo_db, voter_user)
        word = f"TESTBWS{uuid.uuid4().hex[:4]}"
        # voter creates the post → author == voter
        p = api_client.post(f"{BASE_URL}/api/posts",
                            json={"word": word, "image_base64": PNG_1x1},
                            headers=voter_headers).json()
        try:
            assert p.get("author_id") == voter_user["user_id"]
            rv = api_client.post(f"{BASE_URL}/api/posts/{p['post_id']}/vote",
                                 json={"vote": "aprovo"}, headers=voter_headers)
            assert rv.status_code == 200, rv.text
            w = api_client.get(f"{BASE_URL}/api/wallet/me", headers=voter_headers).json()
            assert w["balance"] == 0, f"self-vote should not award BW: {w}"
            assert w["total_earned"] == 0
            assert w["transactions"] == []
        finally:
            mongo_db.votes.delete_many({"post_id": p["post_id"]})
            mongo_db.posts.delete_one({"post_id": p["post_id"]})

    def test_auth_me_includes_bw_balance(self, api_client, auth_headers, voter_headers,
                                         voter_user, mongo_db):
        """GET /api/auth/me reports bw_balance/bw_total_earned matching wallet."""
        _reset_voter_wallet(mongo_db, voter_user)
        word = f"TESTBWM{uuid.uuid4().hex[:4]}"
        p = api_client.post(f"{BASE_URL}/api/posts",
                            json={"word": word, "image_base64": PNG_1x1},
                            headers=auth_headers).json()
        try:
            api_client.post(f"{BASE_URL}/api/posts/{p['post_id']}/vote",
                            json={"vote": "aprovo"}, headers=voter_headers)
            me = api_client.get(f"{BASE_URL}/api/auth/me", headers=voter_headers)
            assert me.status_code == 200, me.text
            mbody = me.json()
            assert "bw_balance" in mbody, f"auth/me missing bw_balance: {mbody.keys()}"
            assert "bw_total_earned" in mbody
            assert mbody["bw_balance"] == 1
            assert mbody["bw_total_earned"] == 1
            w = api_client.get(f"{BASE_URL}/api/wallet/me", headers=voter_headers).json()
            assert mbody["bw_balance"] == w["balance"]
            assert mbody["bw_total_earned"] == w["total_earned"]
        finally:
            mongo_db.votes.delete_many({"post_id": p["post_id"]})
            mongo_db.posts.delete_one({"post_id": p["post_id"]})


# ---------------------------------------------------------------------------
# B. Styles-filtered feed
# ---------------------------------------------------------------------------
class TestStylesFilter:
    def test_styles_feed_no_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/posts?source=styles")
        assert r.status_code == 200, r.text
        assert r.json() == []

    def test_styles_feed_auth_no_follows(self, api_client, auth_headers, seeded_user, mongo_db):
        mongo_db.followed_styles.delete_many({"user_id": seeded_user["user_id"]})
        r = api_client.get(f"{BASE_URL}/api/posts?source=styles", headers=auth_headers)
        assert r.status_code == 200
        assert r.json() == []

    def test_styles_feed_follow_pizza_then_filter(self, api_client, auth_headers,
                                                  seeded_user, mongo_db):
        """Follow 'PIZZA' → feed source=styles only contains PIZZA posts."""
        # Cleanup any leftover
        mongo_db.followed_styles.delete_many({"user_id": seeded_user["user_id"]})

        # Create one PIZZA post and one BURGUER post
        p_pizza = api_client.post(f"{BASE_URL}/api/posts",
                                  json={"word": "PIZZA", "image_base64": PNG_1x1},
                                  headers=auth_headers).json()
        p_burguer = api_client.post(f"{BASE_URL}/api/posts",
                                    json={"word": f"BURGUER{uuid.uuid4().hex[:3]}",
                                          "image_base64": PNG_1x1},
                                    headers=auth_headers).json()

        try:
            # Follow PIZZA
            rf = api_client.post(f"{BASE_URL}/api/styles/PIZZA/follow", headers=auth_headers)
            assert rf.status_code == 200, rf.text

            r = api_client.get(f"{BASE_URL}/api/posts?source=styles", headers=auth_headers)
            assert r.status_code == 200, r.text
            posts = r.json()
            assert len(posts) >= 1, f"expected at least 1 PIZZA post, got {posts}"
            for pp in posts:
                assert pp["word"] == "PIZZA", f"unexpected non-PIZZA in styles feed: {pp['word']}"

            # Unfollow → []
            rd = api_client.delete(f"{BASE_URL}/api/styles/PIZZA/follow", headers=auth_headers)
            assert rd.status_code == 200
            r2 = api_client.get(f"{BASE_URL}/api/posts?source=styles", headers=auth_headers)
            assert r2.status_code == 200
            assert r2.json() == []
        finally:
            mongo_db.posts.delete_one({"post_id": p_pizza["post_id"]})
            mongo_db.posts.delete_one({"post_id": p_burguer["post_id"]})
            mongo_db.followed_styles.delete_many({"user_id": seeded_user["user_id"]})


# ---------------------------------------------------------------------------
# C. Regression smoke for prior iterations
# ---------------------------------------------------------------------------
class TestRegression:
    def test_themes_list(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/themes")
        assert r.status_code == 200
        assert len(r.json()) == 10

    def test_trends_public(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/trends?period=24h")
        assert r.status_code == 200
        body = r.json()
        assert "items" in body and isinstance(body["items"], list)

    def test_follow_status_unauth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/styles/SOMEWORD/status")
        assert r.status_code == 200
        assert r.json()["following"] is False

    def test_invoice_auth_gate(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/business/campaigns/x/invoice")
        assert r.status_code == 401

    def test_posts_recent(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/posts")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
