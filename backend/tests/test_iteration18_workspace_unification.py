"""
Iteration 18 — Workspace unification (single source of truth)

Validates:
- GET /api/countries returns code/name/tax_label for each supported country
- POST /api/workspaces with country_code auto-fills tax_id_label + country_name
- Legacy `nif` field accepted on create (maps to tax_id)
- Mirror: creating a business workspace updates user.business_profile (so legacy code works)
- Migration from legacy business_profile copies all rich fields
- PATCH updates the mirror on business_profile
- tax_id_label respects explicit value if provided (override)
"""
import pytest


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
        assert r.status_code == 200, r.text
        data = r.json()
        codes = {c["code"] for c in data["countries"]}
        # spot-check known countries
        for c in ("BR", "US", "PT", "FR"):
            assert c in codes
        # has tax_label
        pt = next(c for c in data["countries"] if c["code"] == "PT")
        assert pt["tax_label"] == "NIPC"
        br = next(c for c in data["countries"] if c["code"] == "BR")
        assert br["tax_label"] == "CNPJ"


class TestRichWorkspaceFields:
    def test_create_with_country_autofills_label(self, base_url, auth_headers, biz_clean, api_client):
        r = api_client.post(_u(base_url, "/api/workspaces"), headers=auth_headers, json={
            "type": "business", "name": "Padaria BR", "tax_id": "12.345.678/0001-99",
            "billing_email": "fatura@padaria.br", "country_code": "br",
        })
        assert r.status_code == 200, r.text
        ws = r.json()
        assert ws["country_code"] == "BR"
        assert ws["country_name"] == "Brasil"
        assert ws["tax_id_label"] == "CNPJ"
        assert ws["tax_id"] == "12.345.678/0001-99"
        # legacy alias nif still echoed
        assert ws["nif"] == ws["tax_id"]

    def test_legacy_nif_field_accepted(self, base_url, auth_headers, biz_clean, api_client):
        r = api_client.post(_u(base_url, "/api/workspaces"), headers=auth_headers, json={
            "type": "business", "name": "Old Form Co",
            "nif": "PT500111222",  # legacy field name
            "billing_email": "fatura@old.pt", "country_code": "PT",
        })
        assert r.status_code == 200, r.text
        ws = r.json()
        assert ws["tax_id"] == "PT500111222"
        assert ws["tax_id_label"] == "NIPC"

    def test_explicit_label_overrides_country_default(self, base_url, auth_headers, biz_clean, api_client):
        r = api_client.post(_u(base_url, "/api/workspaces"), headers=auth_headers, json={
            "type": "business", "name": "Custom Label",
            "tax_id": "ABC123", "tax_id_label": "MY-CUSTOM-ID",
            "billing_email": "x@y.com", "country_code": "OT",
        })
        assert r.status_code == 200
        assert r.json()["tax_id_label"] == "MY-CUSTOM-ID"


class TestBusinessProfileMirror:
    def test_create_business_workspace_mirrors_to_user(self, base_url, auth_headers, biz_clean, api_client, mongo_db):
        r = api_client.post(_u(base_url, "/api/workspaces"), headers=auth_headers, json={
            "type": "business", "name": "Empresa X PT",
            "tax_id": "PT123456789", "billing_email": "fatura@x.pt",
            "contact_name": "João", "contact_email": "joao@x.pt",
            "country_code": "PT",
        })
        assert r.status_code == 200, r.text
        ws = r.json()
        # Mirror written
        user = mongo_db.users.find_one({"user_id": biz_clean["user_id"]})
        bp = user.get("business_profile") or {}
        assert bp.get("company_name") == "Empresa X PT"
        assert bp.get("country_code") == "PT"
        assert bp.get("country") == "Portugal"
        assert bp.get("tax_id") == "PT123456789"
        assert bp.get("tax_id_label") == "NIPC"
        assert bp.get("contact_name") == "João"
        assert bp.get("contact_email") == "joao@x.pt"
        assert bp.get("active_workspace_id") == ws["workspace_id"]
        # has_business now true on the user_out
        me = api_client.get(_u(base_url, "/api/auth/me"), headers=auth_headers).json()
        assert me["has_business"] is True

    def test_patch_business_workspace_updates_mirror(self, base_url, auth_headers, biz_clean, api_client, mongo_db):
        r = api_client.post(_u(base_url, "/api/workspaces"), headers=auth_headers, json={
            "type": "business", "name": "Original", "tax_id": "X1", "billing_email": "a@a.com",
            "country_code": "PT",
        })
        ws_id = r.json()["workspace_id"]
        r2 = api_client.patch(_u(base_url, f"/api/workspaces/{ws_id}"), headers=auth_headers,
                              json={"name": "Renamed", "country_code": "BR"})
        assert r2.status_code == 200, r2.text
        updated = r2.json()
        assert updated["country_code"] == "BR"
        assert updated["tax_id_label"] == "CNPJ"
        # Mirror updated too
        user = mongo_db.users.find_one({"user_id": biz_clean["user_id"]})
        bp = user["business_profile"]
        assert bp["company_name"] == "Renamed"
        assert bp["tax_id_label"] == "CNPJ"
        assert bp["country"] == "Brasil"


class TestLegacyMigrationStillRich:
    def test_existing_business_profile_migrates_all_fields(self, base_url, auth_headers, biz_clean, api_client, mongo_db):
        # Pretend the user has a legacy rich business_profile
        mongo_db.users.update_one(
            {"user_id": biz_clean["user_id"]},
            {"$set": {"business_profile": {
                "company_name": "Legacy Co PT",
                "country": "Portugal",
                "country_code": "PT",
                "tax_id": "PT9999",
                "contact_email": "old@pt.pt",
                "contact_name": "Maria",
            }}},
        )
        # Trigger migration via /workspaces list
        r = api_client.get(_u(base_url, "/api/workspaces"), headers=auth_headers)
        assert r.status_code == 200
        ws_list = r.json()["workspaces"]
        biz = next(w for w in ws_list if w["type"] == "business")
        assert biz["name"] == "Legacy Co PT"
        assert biz["country_code"] == "PT"
        assert biz["country_name"] == "Portugal"
        assert biz["tax_id"] == "PT9999"
        assert biz["tax_id_label"] == "NIPC"
        assert biz["contact_name"] == "Maria"
        assert biz["contact_email"] == "old@pt.pt"
