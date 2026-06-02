"""
Iteration 18 — Workspace unification + tax-ID validation + email verification
"""
import pytest

VALID_PT_NIPC = "509442013"   # real PT NIPC (passes mod-11)
VALID_BR_CNPJ = "11.222.333/0001-81"
VALID_ES_CIF = "B12345674"
VALID_US_EIN = "12-3456789"


def _u(base, path): return f"{base}{path}"


@pytest.fixture
def biz_clean(mongo_db, seeded_user):
    mongo_db.workspaces.delete_many({"owner_user_id": seeded_user["user_id"]})
    mongo_db.users.update_one({"user_id": seeded_user["user_id"]},
                               {"$unset": {"business_profile": "", "active_workspace_id": ""}})
    yield seeded_user
    mongo_db.workspaces.delete_many({"owner_user_id": seeded_user["user_id"]})
    mongo_db.users.update_one({"user_id": seeded_user["user_id"]},
                               {"$unset": {"business_profile": "", "active_workspace_id": ""}})


class TestCountriesEndpoint:
    def test_lists_supported_countries(self, base_url, api_client):
        r = api_client.get(_u(base_url, "/api/countries"))
        assert r.status_code == 200
        data = r.json()
        codes = {c["code"] for c in data["countries"]}
        for c in ("BR", "US", "PT", "FR"):
            assert c in codes
        pt = next(c for c in data["countries"] if c["code"] == "PT")
        assert pt["tax_label"] == "NIPC"
        br = next(c for c in data["countries"] if c["code"] == "BR")
        assert br["tax_label"] == "CNPJ"


class TestTaxIdValidation:
    def test_reject_all_zeros_nipc(self, base_url, auth_headers, biz_clean, api_client):
        r = api_client.post(_u(base_url, "/api/workspaces"), headers=auth_headers, json={
            "type": "business", "name": "Bogus Co", "tax_id": "000000000",
            "billing_email": "x@x.com", "country_code": "PT",
        })
        assert r.status_code == 400
        assert "NIPC" in r.text or "inválido" in r.text.lower()

    def test_reject_bad_checksum_nipc(self, base_url, auth_headers, biz_clean, api_client):
        r = api_client.post(_u(base_url, "/api/workspaces"), headers=auth_headers, json={
            "type": "business", "name": "Bogus 2", "tax_id": "509442012",  # last digit wrong
            "billing_email": "x@x.com", "country_code": "PT",
        })
        assert r.status_code == 400

    def test_accept_valid_nipc(self, base_url, auth_headers, biz_clean, api_client):
        r = api_client.post(_u(base_url, "/api/workspaces"), headers=auth_headers, json={
            "type": "business", "name": "Empresa PT", "tax_id": VALID_PT_NIPC,
            "billing_email": "fatura@empresa.pt", "country_code": "PT",
        })
        assert r.status_code == 200, r.text
        assert r.json()["tax_id"] == VALID_PT_NIPC

    def test_reject_bad_cnpj(self, base_url, auth_headers, biz_clean, api_client):
        r = api_client.post(_u(base_url, "/api/workspaces"), headers=auth_headers, json={
            "type": "business", "name": "Bogus BR", "tax_id": "11111111000111",
            "billing_email": "x@x.com", "country_code": "BR",
        })
        assert r.status_code == 400

    def test_accept_valid_cnpj_with_format(self, base_url, auth_headers, biz_clean, api_client):
        r = api_client.post(_u(base_url, "/api/workspaces"), headers=auth_headers, json={
            "type": "business", "name": "Empresa BR", "tax_id": "11222333000181",  # no formatting
            "billing_email": "fatura@empresa.br", "country_code": "BR",
        })
        assert r.status_code == 200, r.text
        assert r.json()["tax_id"] == VALID_BR_CNPJ  # validator pretty-formats


class TestRichWorkspaceFields:
    def test_create_with_country_autofills_label(self, base_url, auth_headers, biz_clean, api_client):
        r = api_client.post(_u(base_url, "/api/workspaces"), headers=auth_headers, json={
            "type": "business", "name": "Padaria BR", "tax_id": VALID_BR_CNPJ,
            "billing_email": "fatura@padaria.br", "country_code": "br",
        })
        assert r.status_code == 200, r.text
        ws = r.json()
        assert ws["country_code"] == "BR"
        assert ws["country_name"] == "Brasil"
        assert ws["tax_id_label"] == "CNPJ"
        assert ws["nif"] == ws["tax_id"]
        assert ws["verified"] is False

    def test_legacy_nif_field_accepted(self, base_url, auth_headers, biz_clean, api_client):
        r = api_client.post(_u(base_url, "/api/workspaces"), headers=auth_headers, json={
            "type": "business", "name": "Old Form Co",
            "nif": VALID_PT_NIPC,  # legacy field name
            "billing_email": "fatura@old.pt", "country_code": "PT",
        })
        assert r.status_code == 200, r.text
        ws = r.json()
        assert ws["tax_id"] == VALID_PT_NIPC
        assert ws["tax_id_label"] == "NIPC"


class TestBusinessProfileMirror:
    def test_create_business_workspace_mirrors_to_user(self, base_url, auth_headers, biz_clean, api_client, mongo_db):
        r = api_client.post(_u(base_url, "/api/workspaces"), headers=auth_headers, json={
            "type": "business", "name": "Empresa X PT",
            "tax_id": VALID_PT_NIPC, "billing_email": "fatura@x.pt",
            "contact_name": "João", "contact_email": "joao@x.pt",
            "country_code": "PT",
        })
        assert r.status_code == 200, r.text
        ws = r.json()
        user = mongo_db.users.find_one({"user_id": biz_clean["user_id"]})
        bp = user.get("business_profile") or {}
        assert bp.get("company_name") == "Empresa X PT"
        assert bp.get("country_code") == "PT"
        assert bp.get("tax_id_label") == "NIPC"
        me = api_client.get(_u(base_url, "/api/auth/me"), headers=auth_headers).json()
        assert me["has_business"] is True


class TestEmailVerification:
    def test_workspace_starts_unverified(self, base_url, auth_headers, biz_clean, api_client):
        r = api_client.post(_u(base_url, "/api/workspaces"), headers=auth_headers, json={
            "type": "business", "name": "To verify",
            "tax_id": VALID_PT_NIPC, "billing_email": "fatura@v.pt", "country_code": "PT",
        })
        assert r.json()["verified"] is False

    def test_create_workspace_sends_verification_email(self, base_url, auth_headers, biz_clean, api_client, monkeypatch):
        import sys
        sys.path.insert(0, "/app/backend")
        import email_alerts

        called = {}
        def fake_send(params):
            called["params"] = params
            return {"id": "fake-email-id"}

        monkeypatch.setattr(email_alerts, "RESEND_API_KEY", "test", raising=False)
        monkeypatch.setattr(email_alerts.resend, "api_key", "test", raising=False)
        monkeypatch.setattr(email_alerts.resend.Emails, "send", fake_send)

        r = api_client.post(_u(base_url, "/api/workspaces"), headers=auth_headers, json={
            "type": "business", "name": "Empresa Email Test",
            "tax_id": VALID_PT_NIPC, "billing_email": "fatura@send.pt", "country_code": "PT",
        })
        assert r.status_code == 200, r.text
        assert called["params"]["to"] == ["fatura@send.pt"]
        assert "Confirmar email" in called["params"]["html"]
        assert "Empresa Email Test" in called["params"]["html"]

    def test_confirm_with_bad_token_fails(self, base_url, auth_headers, biz_clean, api_client):
        r = api_client.post(_u(base_url, "/api/workspaces"), headers=auth_headers, json={
            "type": "business", "name": "Confirm Test",
            "tax_id": VALID_PT_NIPC, "billing_email": "fatura@c.pt", "country_code": "PT",
        })
        ws_id = r.json()["workspace_id"]
        r2 = api_client.post(_u(base_url, f"/api/workspaces/{ws_id}/verify-email/confirm"),
                              headers=auth_headers, json={"token": "wrong-token-12345"})
        assert r2.status_code == 400

    def test_full_verify_flow(self, base_url, auth_headers, biz_clean, api_client, mongo_db):
        r = api_client.post(_u(base_url, "/api/workspaces"), headers=auth_headers, json={
            "type": "business", "name": "Full Verify",
            "tax_id": VALID_PT_NIPC, "billing_email": "fatura@f.pt", "country_code": "PT",
        })
        ws_id = r.json()["workspace_id"]
        # Inject a known plain token via bcrypt hash (since real one is logged not returned)
        from passlib.context import CryptContext
        ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        plain = "known-test-token-AAAA"
        mongo_db.workspaces.update_one(
            {"workspace_id": ws_id},
            {"$set": {"verification_token_hash": ctx.hash(plain)}},
        )
        r2 = api_client.post(_u(base_url, f"/api/workspaces/{ws_id}/verify-email/confirm"),
                              headers=auth_headers, json={"token": plain})
        assert r2.status_code == 200, r2.text
        assert r2.json()["verified"] is True
        ws_db = mongo_db.workspaces.find_one({"workspace_id": ws_id})
        assert ws_db["verified"] is True
        assert "verification_token_hash" not in ws_db

    def test_unverified_workspace_cannot_create_campaign(self, base_url, auth_headers, biz_clean, api_client):
        r = api_client.post(_u(base_url, "/api/workspaces"), headers=auth_headers, json={
            "type": "business", "name": "Blocked Co",
            "tax_id": VALID_PT_NIPC, "billing_email": "fatura@b.pt", "country_code": "PT",
        })
        ws_id = r.json()["workspace_id"]
        rc = api_client.post(_u(base_url, "/api/business/campaigns"), headers=auth_headers, json={
            "word": "BLOCKED", "image_base64": "data:image/jpeg;base64," + "A" * 80,
            "tier_key": "global", "workspace_id": ws_id,
        })
        assert rc.status_code == 403
        assert "verificada" in rc.text.lower()

    def test_verified_workspace_can_create_campaign(self, base_url, auth_headers, biz_clean, api_client, mongo_db):
        r = api_client.post(_u(base_url, "/api/workspaces"), headers=auth_headers, json={
            "type": "business", "name": "Verified Co",
            "tax_id": VALID_PT_NIPC, "billing_email": "fatura@v2.pt", "country_code": "PT",
        })
        ws_id = r.json()["workspace_id"]
        # Mark verified directly
        from datetime import datetime, timezone
        mongo_db.workspaces.update_one(
            {"workspace_id": ws_id},
            {"$set": {"verified": True, "verified_at": datetime.now(timezone.utc)}},
        )
        rc = api_client.post(_u(base_url, "/api/business/campaigns"), headers=auth_headers, json={
            "word": "OKVERIFIED", "image_base64": "data:image/jpeg;base64," + "A" * 80,
            "tier_key": "global", "workspace_id": ws_id,
        })
        assert rc.status_code == 200, rc.text
        assert rc.json()["workspace_id"] == ws_id
