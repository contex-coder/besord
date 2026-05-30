"""Backend API tests for Besord (FastAPI + MongoDB)."""
import base64
import requests


# Minimal valid 1x1 PNG base64 (well over 50 chars in data URI form)
_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)
DUMMY_IMAGE_B64 = "data:image/png;base64," + base64.b64encode(_PNG_BYTES).decode() + ("A" * 100)


# ----------------- Health -----------------
class TestHealth:
    def test_root_ok(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("status") == "ok"
        assert "message" in body


# ----------------- Auth Unauthenticated -----------------
class TestAuthUnauth:
    def test_session_invalid_id(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/session", json={"session_id": "INVALID_BOGUS_ID"})
        assert r.status_code == 401, r.text

    def test_me_no_header(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401

    def test_me_invalid_token(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/auth/me", headers={"Authorization": "Bearer not_a_real_token_xyz"})
        assert r.status_code == 401

    def test_logout_no_auth_ok(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/logout")
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_list_posts_public(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/posts")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for p in data:
            assert p.get("user_vote") is None

    def test_create_post_requires_auth(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/posts", json={"word": "TESTE", "image_base64": DUMMY_IMAGE_B64})
        assert r.status_code == 401

    def test_vote_requires_auth(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/posts/nope_id/vote", json={"vote": "aprovo"})
        assert r.status_code == 401

    def test_delete_requires_auth(self, api_client, base_url):
        r = api_client.delete(f"{base_url}/api/posts/nope_id")
        assert r.status_code == 401


# ----------------- Authenticated full flow (Mongo-injection auth) -----------------
class TestAuthenticatedFlow:
    def test_me_with_seeded_token(self, api_client, base_url, auth_headers, seeded_user):
        r = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["user_id"] == seeded_user["user_id"]
        assert u["email"] == seeded_user["email"]
        assert u["name"] == "Test User"

    def test_create_post_and_persist(self, api_client, base_url, auth_headers, seeded_user):
        payload = {"word": "Alegria1", "image_base64": DUMMY_IMAGE_B64}
        r = api_client.post(f"{base_url}/api/posts", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        post = r.json()
        assert post["word"] == "ALEGRIA1"  # uppercased
        assert post["author_id"] == seeded_user["user_id"]
        assert post["aprovo_count"] == 0
        assert post["desaprovo_count"] == 0
        assert post["user_vote"] is None

        # GET list and verify present
        r2 = api_client.get(f"{base_url}/api/posts", headers=auth_headers)
        assert r2.status_code == 200
        ids = [p["post_id"] for p in r2.json()]
        assert post["post_id"] in ids

        # save for next test on class via attribute
        TestAuthenticatedFlow.created_post_id = post["post_id"]

    def test_vote_aprovo_increments(self, api_client, base_url, auth_headers):
        pid = TestAuthenticatedFlow.created_post_id
        r = api_client.post(f"{base_url}/api/posts/{pid}/vote", json={"vote": "aprovo"}, headers=auth_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["aprovo_count"] == 1
        assert d["desaprovo_count"] == 0
        assert d["user_vote"] == "aprovo"

    def test_vote_toggle_off(self, api_client, base_url, auth_headers):
        pid = TestAuthenticatedFlow.created_post_id
        r = api_client.post(f"{base_url}/api/posts/{pid}/vote", json={"vote": "aprovo"}, headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["aprovo_count"] == 0
        assert d["user_vote"] is None

    def test_vote_switch_to_desaprovo(self, api_client, base_url, auth_headers):
        pid = TestAuthenticatedFlow.created_post_id
        # First add aprovo
        r1 = api_client.post(f"{base_url}/api/posts/{pid}/vote", json={"vote": "aprovo"}, headers=auth_headers)
        assert r1.status_code == 200
        assert r1.json()["aprovo_count"] == 1
        # Now switch to desaprovo
        r2 = api_client.post(f"{base_url}/api/posts/{pid}/vote", json={"vote": "desaprovo"}, headers=auth_headers)
        assert r2.status_code == 200
        d = r2.json()
        assert d["aprovo_count"] == 0
        assert d["desaprovo_count"] == 1
        assert d["user_vote"] == "desaprovo"

    def test_delete_post(self, api_client, base_url, auth_headers, mongo_db):
        pid = TestAuthenticatedFlow.created_post_id
        r = api_client.delete(f"{base_url}/api/posts/{pid}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json().get("ok") is True
        # Verify gone in mongo
        assert mongo_db.posts.find_one({"post_id": pid}) is None
        # Votes cascaded
        assert mongo_db.votes.find_one({"post_id": pid}) is None

    def test_delete_other_user_post_forbidden(self, api_client, base_url, auth_headers, mongo_db):
        # Insert a post owned by someone else
        from datetime import datetime, timezone
        other_pid = "post_other_user_xyz"
        mongo_db.posts.insert_one({
            "post_id": other_pid, "word": "OUTRO", "image_base64": DUMMY_IMAGE_B64,
            "author_id": "user_other", "author_name": "Other", "author_picture": None,
            "created_at": datetime.now(timezone.utc), "aprovo_count": 0, "desaprovo_count": 0,
        })
        try:
            r = api_client.delete(f"{base_url}/api/posts/{other_pid}", headers=auth_headers)
            assert r.status_code == 403
        finally:
            mongo_db.posts.delete_one({"post_id": other_pid})

    def test_vote_nonexistent_post(self, api_client, base_url, auth_headers):
        r = api_client.post(f"{base_url}/api/posts/post_does_not_exist/vote", json={"vote": "aprovo"}, headers=auth_headers)
        assert r.status_code == 404


# ----------------- Validation -----------------
class TestValidation:
    def test_word_with_space_rejected(self, api_client, base_url, auth_headers):
        r = api_client.post(f"{base_url}/api/posts", json={"word": "two words", "image_base64": DUMMY_IMAGE_B64}, headers=auth_headers)
        assert r.status_code == 400

    def test_word_special_char_rejected(self, api_client, base_url, auth_headers):
        r = api_client.post(f"{base_url}/api/posts", json={"word": "bad!", "image_base64": DUMMY_IMAGE_B64}, headers=auth_headers)
        assert r.status_code == 400

    def test_word_too_long_rejected(self, api_client, base_url, auth_headers):
        r = api_client.post(f"{base_url}/api/posts", json={"word": "A" * 21, "image_base64": DUMMY_IMAGE_B64}, headers=auth_headers)
        assert r.status_code == 400

    def test_word_letters_numbers_accepted(self, api_client, base_url, auth_headers, mongo_db):
        r = api_client.post(f"{base_url}/api/posts", json={"word": "Palavra2026", "image_base64": DUMMY_IMAGE_B64}, headers=auth_headers)
        assert r.status_code == 200, r.text
        pid = r.json()["post_id"]
        # cleanup
        mongo_db.posts.delete_one({"post_id": pid})

    def test_image_too_short_rejected(self, api_client, base_url, auth_headers):
        r = api_client.post(f"{base_url}/api/posts", json={"word": "OK", "image_base64": "short"}, headers=auth_headers)
        assert r.status_code == 400

    def test_image_empty_rejected(self, api_client, base_url, auth_headers):
        r = api_client.post(f"{base_url}/api/posts", json={"word": "OK", "image_base64": ""}, headers=auth_headers)
        assert r.status_code == 400


# ----------------- Logout -----------------
class TestLogoutFlow:
    def test_logout_invalidates_session(self, api_client, base_url, mongo_db):
        # Seed a one-off session
        from datetime import datetime, timezone, timedelta
        tok = "test_logout_token_zzz"
        uid = "user_test_logout"
        mongo_db.users.insert_one({
            "user_id": uid, "email": "TEST_logout@example.com", "name": "L", "picture": None,
            "created_at": datetime.now(timezone.utc),
        })
        mongo_db.user_sessions.insert_one({
            "session_token": tok, "user_id": uid,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
            "created_at": datetime.now(timezone.utc),
        })
        try:
            h = {"Authorization": f"Bearer {tok}"}
            assert api_client.get(f"{base_url}/api/auth/me", headers=h).status_code == 200
            assert api_client.post(f"{base_url}/api/auth/logout", headers=h).status_code == 200
            assert api_client.get(f"{base_url}/api/auth/me", headers=h).status_code == 401
        finally:
            mongo_db.users.delete_many({"user_id": uid})
            mongo_db.user_sessions.delete_many({"session_token": tok})
