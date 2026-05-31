"""Iteration 4 backend regression — focus on endpoints touched/relevant for the iteration 4 frontend fixes.

Scope per review_request:
  - DELETE /api/posts/{post_id}       — author 200, non-author 403, missing 404
  - POST   /api/posts/{post_id}/comment — upsert semantics + comments_count doesn't double
  - DELETE /api/posts/{post_id}/comment — removes + decrements count
  - POST   /api/posts/{post_id}/vote   — sanity
  - GET    /api/posts?sort=recent|trending — sanity
  - GET    /api/auth/me                — sanity
"""
import base64
import uuid
from datetime import datetime, timezone, timedelta

import pytest

_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)
DUMMY_IMG = "data:image/png;base64," + base64.b64encode(_PNG).decode() + ("A" * 100)


# ---------- Second seeded user (non-author) ----------
@pytest.fixture(scope="module")
def other_user(mongo_db):
    uid = "user_TEST_iter4_other"
    tok = "TEST_iter4_other_token"
    email = "TEST_iter4_other@example.com"
    mongo_db.users.delete_many({"user_id": uid})
    mongo_db.user_sessions.delete_many({"session_token": tok})
    mongo_db.users.insert_one({
        "user_id": uid, "email": email, "name": "Other Tester",
        "picture": None, "created_at": datetime.now(timezone.utc),
    })
    mongo_db.user_sessions.insert_one({
        "session_token": tok, "user_id": uid,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    yield {"user_id": uid, "session_token": tok, "email": email}
    mongo_db.users.delete_many({"user_id": uid})
    mongo_db.user_sessions.delete_many({"session_token": tok})
    mongo_db.posts.delete_many({"author_id": uid})


@pytest.fixture
def other_headers(other_user):
    return {"Authorization": f"Bearer {other_user['session_token']}", "Content-Type": "application/json"}


# ---------- Auth ----------
class TestAuthMe:
    def test_me_authenticated(self, api_client, base_url, auth_headers, seeded_user):
        r = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user_id"] == seeded_user["user_id"]
        assert body["email"] == seeded_user["email"]

    def test_me_unauth(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401


# ---------- Feed sort ----------
class TestFeedSort:
    def test_recent_sort(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/posts?sort=recent")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_trending_sort(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/posts?sort=trending")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Post deletion ----------
class TestDeletePost:
    def test_author_can_delete(self, api_client, base_url, auth_headers, mongo_db):
        r = api_client.post(f"{base_url}/api/posts", json={"word": "DelOwn", "image_base64": DUMMY_IMG}, headers=auth_headers)
        assert r.status_code == 200, r.text
        pid = r.json()["post_id"]
        rd = api_client.delete(f"{base_url}/api/posts/{pid}", headers=auth_headers)
        assert rd.status_code == 200, rd.text
        # confirm gone
        assert mongo_db.posts.find_one({"post_id": pid}) is None

    def test_non_author_403(self, api_client, base_url, auth_headers, other_headers):
        r = api_client.post(f"{base_url}/api/posts", json={"word": "DelNo", "image_base64": DUMMY_IMG}, headers=auth_headers)
        assert r.status_code == 200
        pid = r.json()["post_id"]
        try:
            rd = api_client.delete(f"{base_url}/api/posts/{pid}", headers=other_headers)
            assert rd.status_code == 403, rd.text
        finally:
            api_client.delete(f"{base_url}/api/posts/{pid}", headers=auth_headers)

    def test_missing_404(self, api_client, base_url, auth_headers):
        rd = api_client.delete(f"{base_url}/api/posts/post_does_not_exist_xxx", headers=auth_headers)
        assert rd.status_code == 404


# ---------- Comment upsert + count ----------
class TestCommentUpsert:
    def test_double_comment_updates_and_does_not_increment_count(self, api_client, base_url, auth_headers):
        # Create post
        rp = api_client.post(f"{base_url}/api/posts", json={"word": "CmtPost", "image_base64": DUMMY_IMG}, headers=auth_headers)
        assert rp.status_code == 200
        pid = rp.json()["post_id"]
        try:
            # First comment
            r1 = api_client.post(f"{base_url}/api/posts/{pid}/comment",
                                 json={"word": "FirstWord"}, headers=auth_headers)
            assert r1.status_code == 200, r1.text
            b1 = r1.json()
            assert b1["comments_count"] == 1
            assert b1.get("user_comment", "").upper() == "FIRSTWORD"

            # Second comment (different word) — must update, not insert
            r2 = api_client.post(f"{base_url}/api/posts/{pid}/comment",
                                 json={"word": "SecondWord"}, headers=auth_headers)
            assert r2.status_code == 200, r2.text
            b2 = r2.json()
            assert b2["comments_count"] == 1, f"Expected count to stay at 1, got {b2['comments_count']}"
            assert b2.get("user_comment", "").upper() == "SECONDWORD"
        finally:
            api_client.delete(f"{base_url}/api/posts/{pid}", headers=auth_headers)

    def test_delete_comment_decrements_count(self, api_client, base_url, auth_headers):
        rp = api_client.post(f"{base_url}/api/posts", json={"word": "DelCmt", "image_base64": DUMMY_IMG}, headers=auth_headers)
        assert rp.status_code == 200
        pid = rp.json()["post_id"]
        try:
            r1 = api_client.post(f"{base_url}/api/posts/{pid}/comment",
                                 json={"word": "ToDelete"}, headers=auth_headers)
            assert r1.status_code == 200
            assert r1.json()["comments_count"] == 1

            rd = api_client.delete(f"{base_url}/api/posts/{pid}/comment", headers=auth_headers)
            assert rd.status_code == 200, rd.text
            body = rd.json()
            assert body["comments_count"] == 0
            assert body.get("user_comment") in (None, "")
        finally:
            api_client.delete(f"{base_url}/api/posts/{pid}", headers=auth_headers)


# ---------- Vote ----------
class TestVote:
    def test_vote_aprovo_and_toggle(self, api_client, base_url, auth_headers, other_headers):
        rp = api_client.post(f"{base_url}/api/posts", json={"word": "VoteIt", "image_base64": DUMMY_IMG}, headers=other_headers)
        assert rp.status_code == 200
        pid = rp.json()["post_id"]
        try:
            r1 = api_client.post(f"{base_url}/api/posts/{pid}/vote", json={"vote": "aprovo"}, headers=auth_headers)
            assert r1.status_code == 200, r1.text
            b1 = r1.json()
            assert b1["aprovo_count"] == 1
            assert b1["user_vote"] == "aprovo"

            # Switch to desaprovo
            r2 = api_client.post(f"{base_url}/api/posts/{pid}/vote", json={"vote": "desaprovo"}, headers=auth_headers)
            assert r2.status_code == 200
            b2 = r2.json()
            assert b2["aprovo_count"] == 0
            assert b2["desaprovo_count"] == 1
            assert b2["user_vote"] == "desaprovo"
        finally:
            api_client.delete(f"{base_url}/api/posts/{pid}", headers=other_headers)
