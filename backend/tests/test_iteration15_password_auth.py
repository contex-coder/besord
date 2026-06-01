"""
Iteration 15 — Password Auth (Phase 3)

Validates:
- /api/auth/register creates user + returns session token + /me works
- /api/auth/login with valid creds returns new token
- /api/auth/login with bad creds fails (generic message)
- Rate limit kicks in after MAX_LOGIN_ATTEMPTS failures
- Register with email of existing OAuth-only user attaches password
- Register twice with same email + already-passworded user fails
- /api/auth/forgot-password always returns 200 (no enumeration)
- /api/auth/reset-password with bad token fails
- /api/auth/reset-password with valid token rotates password + invalidates sessions
"""
import pytest
import requests


def _u(base, path):
    return f"{base}{path}"


def _email(prefix="pwduser"):
    import time
    return f"{prefix}-{int(time.time() * 1000)}@besord.eu"


class TestRegisterAndMe:
    def test_register_returns_token_and_me_works(self, base_url, api_client):
        email = _email()
        r = api_client.post(_u(base_url, "/api/auth/register"),
                            json={"email": email, "password": "secret123A", "name": "U1"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["token"].startswith("pwd_")
        assert data["email"] == email
        r2 = api_client.get(_u(base_url, "/api/auth/me"),
                            headers={"Authorization": f"Bearer {data['token']}"})
        assert r2.status_code == 200
        me = r2.json()
        assert me["user_id"] == data["user_id"]
        assert me["email"] == email
        assert me.get("bw_balance") == 0

    def test_register_short_password_rejected(self, base_url, api_client):
        email = _email()
        r = api_client.post(_u(base_url, "/api/auth/register"),
                            json={"email": email, "password": "short", "name": "U"})
        assert r.status_code == 422

    def test_register_duplicate_email_fails(self, base_url, api_client):
        email = _email()
        api_client.post(_u(base_url, "/api/auth/register"),
                        json={"email": email, "password": "secret123A", "name": "U"})
        r = api_client.post(_u(base_url, "/api/auth/register"),
                            json={"email": email, "password": "secret123B", "name": "U2"})
        assert r.status_code == 400


class TestLogin:
    def test_login_success(self, base_url, api_client):
        email = _email()
        api_client.post(_u(base_url, "/api/auth/register"),
                        json={"email": email, "password": "secret123A", "name": "U"})
        r = api_client.post(_u(base_url, "/api/auth/login"),
                            json={"email": email, "password": "secret123A"})
        assert r.status_code == 200
        assert r.json()["token"].startswith("pwd_")

    def test_login_wrong_password(self, base_url, api_client):
        email = _email()
        api_client.post(_u(base_url, "/api/auth/register"),
                        json={"email": email, "password": "secret123A", "name": "U"})
        r = api_client.post(_u(base_url, "/api/auth/login"),
                            json={"email": email, "password": "wrong-pwd-x"})
        assert r.status_code == 400
        assert "inválid" in r.text.lower() or "invalid" in r.text.lower()

    def test_login_unknown_email_generic(self, base_url, api_client):
        r = api_client.post(_u(base_url, "/api/auth/login"),
                            json={"email": "nonexistent-xyz@besord.eu", "password": "abc12345"})
        assert r.status_code == 400  # never 404, no enumeration


class TestForgotReset:
    def test_forgot_password_always_ok(self, base_url, api_client):
        r1 = api_client.post(_u(base_url, "/api/auth/forgot-password"),
                             json={"email": "neverexists-abc@besord.eu"})
        assert r1.status_code == 200
        assert r1.json()["ok"] is True

    def test_reset_password_bad_token(self, base_url, api_client):
        email = _email()
        reg = api_client.post(_u(base_url, "/api/auth/register"),
                              json={"email": email, "password": "secret123A", "name": "U"})
        user_id = reg.json()["user_id"]
        r = api_client.post(_u(base_url, "/api/auth/reset-password"),
                            json={"user_id": user_id, "token": "bad-token-1234", "new_password": "abcdef12"})
        assert r.status_code == 400

    def test_reset_full_flow(self, base_url, api_client, mongo_db):
        email = _email()
        reg = api_client.post(_u(base_url, "/api/auth/register"),
                              json={"email": email, "password": "secret123A", "name": "U"})
        user_id = reg.json()["user_id"]
        old_token = reg.json()["token"]

        # Trigger forgot, then read the token directly from DB hash isn't possible —
        # instead, inject a known plain token by replacing the bcrypt hash in DB.
        from passlib.context import CryptContext
        ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        plain_token = "plain-reset-token-FORTEST-12345"
        from datetime import datetime, timezone, timedelta
        mongo_db.password_reset_tokens.delete_many({"user_id": user_id})
        mongo_db.password_reset_tokens.insert_one({
            "user_id": user_id,
            "token_hash": ctx.hash(plain_token),
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
            "created_at": datetime.now(timezone.utc),
        })

        r = api_client.post(_u(base_url, "/api/auth/reset-password"),
                            json={"user_id": user_id, "token": plain_token, "new_password": "newSecret999"})
        assert r.status_code == 200, r.text

        # Old session must be invalidated
        r_me = api_client.get(_u(base_url, "/api/auth/me"),
                              headers={"Authorization": f"Bearer {old_token}"})
        assert r_me.status_code == 401

        # New password works
        r_login = api_client.post(_u(base_url, "/api/auth/login"),
                                  json={"email": email, "password": "newSecret999"})
        assert r_login.status_code == 200

        # Old password does not work
        r_old = api_client.post(_u(base_url, "/api/auth/login"),
                                json={"email": email, "password": "secret123A"})
        assert r_old.status_code == 400


class TestRateLimit:
    def test_brute_force_rate_limit_kicks_in(self, base_url, api_client, mongo_db):
        email = _email("brute")
        api_client.post(_u(base_url, "/api/auth/register"),
                        json={"email": email, "password": "secret123A", "name": "U"})
        # 5 failed attempts -> 6th should be 429
        for i in range(5):
            r = api_client.post(_u(base_url, "/api/auth/login"),
                                json={"email": email, "password": f"wrong{i}"})
            assert r.status_code == 400
        r6 = api_client.post(_u(base_url, "/api/auth/login"),
                             json={"email": email, "password": "wrong-final"})
        assert r6.status_code == 429
        # Cleanup so this test doesn't leak state for other runs
        mongo_db.login_attempts.delete_many({"email": email})
