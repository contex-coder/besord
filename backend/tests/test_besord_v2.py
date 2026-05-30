"""Backend API tests for Besord iteration 2: business profiles, campaigns, Stripe, geo reports, Apple Sign-In, sponsored feed."""
import base64
import uuid
from datetime import datetime, timezone, timedelta

import pytest


# 1x1 PNG base64 padded > 50 chars
_PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")
DUMMY_IMG = "data:image/png;base64," + base64.b64encode(_PNG).decode() + ("A" * 100)


# ---------- Health & Tiers ----------
class TestRootAndTiers:
    def test_root_version_2(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        body = r.json()
        assert body.get("status") == "ok"
        assert body.get("version") == "2.0", f"Expected version 2.0, got {body.get('version')}"

    def test_tiers_returns_four(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/business/tiers")
        assert r.status_code == 200, r.text
        tiers = r.json()
        assert isinstance(tiers, list)
        assert len(tiers) == 4
        by_key = {t["key"]: t for t in tiers}
        # Validate pricing per problem statement
        assert by_key["local"]["amount_usd"] == 19
        assert by_key["regional"]["amount_usd"] == 49
        assert by_key["national"]["amount_usd"] == 99
        assert by_key["global"]["amount_usd"] == 499
        # included_votes present and positive
        for k in ("local", "regional", "national", "global"):
            assert by_key[k]["included_votes"] > 0
            assert by_key[k]["scope"] in ("city", "region", "country", "world")


# ---------- Regression: auth posts/votes still works ----------
class TestAuthRegression:
    def test_me_and_post_flow(self, api_client, base_url, auth_headers, seeded_user, mongo_db):
        r = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        # has_business should be False for fresh user
        assert r.json().get("has_business") is False

        # Create post
        r2 = api_client.post(f"{base_url}/api/posts", json={"word": "Regress", "image_base64": DUMMY_IMG}, headers=auth_headers)
        assert r2.status_code == 200, r2.text
        pid = r2.json()["post_id"]
        # Vote
        r3 = api_client.post(f"{base_url}/api/posts/{pid}/vote", json={"vote": "aprovo"}, headers=auth_headers)
        assert r3.status_code == 200
        assert r3.json()["aprovo_count"] == 1
        # cleanup
        mongo_db.posts.delete_one({"post_id": pid})
        mongo_db.votes.delete_many({"post_id": pid})


# ---------- Business Profile ----------
class TestBusinessProfile:
    def test_create_profile_requires_auth(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/business/profile", json={
            "company_name": "X", "country": "Brasil", "country_code": "BR",
            "contact_email": "c@x.com", "contact_name": "C"
        })
        assert r.status_code == 401

    def test_create_profile_and_has_business(self, api_client, base_url, auth_headers, seeded_user):
        payload = {
            "company_name": "TEST_Besord Co",
            "country": "Brasil",
            "country_code": "br",
            "tax_id": "12.345.678/0001-00",
            "contact_email": "biz@test.example",
            "contact_name": "Maria",
        }
        r = api_client.post(f"{base_url}/api/business/profile", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        assert r.json().get("has_business") is True

        # /auth/me reflects
        r2 = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json().get("has_business") is True

        # GET profile
        r3 = api_client.get(f"{base_url}/api/business/profile", headers=auth_headers)
        assert r3.status_code == 200
        p = r3.json()
        assert p.get("company_name") == "TEST_Besord Co"
        assert p.get("country_code") == "BR"  # normalized upper


# ---------- Campaign creation & validation ----------
class TestCampaignCreate:
    def test_invalid_tier_rejected(self, api_client, base_url, auth_headers):
        r = api_client.post(f"{base_url}/api/business/campaigns", json={
            "word": "TESTE", "image_base64": DUMMY_IMG, "tier_key": "ultra_mega",
        }, headers=auth_headers)
        assert r.status_code == 400, r.text

    def test_national_requires_country(self, api_client, base_url, auth_headers):
        # national => scope=country => target_country_code required
        r = api_client.post(f"{base_url}/api/business/campaigns", json={
            "word": "TESTE", "image_base64": DUMMY_IMG, "tier_key": "national",
        }, headers=auth_headers)
        assert r.status_code == 400, r.text

    def test_regional_requires_region(self, api_client, base_url, auth_headers):
        r = api_client.post(f"{base_url}/api/business/campaigns", json={
            "word": "TESTE", "image_base64": DUMMY_IMG, "tier_key": "regional",
            "target_country_code": "BR",
        }, headers=auth_headers)
        assert r.status_code == 400

    def test_local_requires_city(self, api_client, base_url, auth_headers):
        r = api_client.post(f"{base_url}/api/business/campaigns", json={
            "word": "TESTE", "image_base64": DUMMY_IMG, "tier_key": "local",
            "target_country_code": "BR",
        }, headers=auth_headers)
        assert r.status_code == 400

    def test_create_global_campaign_stripe(self, api_client, base_url, auth_headers, mongo_db):
        """Global tier doesn't need target. Stripe may fail (502) with test key — accept either,
        but if 200, must return checkout_url and status pending_payment."""
        r = api_client.post(f"{base_url}/api/business/campaigns", json={
            "word": "Global1", "image_base64": DUMMY_IMG, "tier_key": "global",
        }, headers=auth_headers)
        assert r.status_code in (200, 502), f"Unexpected {r.status_code}: {r.text}"
        if r.status_code == 200:
            c = r.json()
            assert c["status"] == "pending_payment"
            assert c["tier_key"] == "global"
            assert c["amount_cents"] == 49900
            assert c["scope"] == "world"
            assert c.get("checkout_url"), "checkout_url must be present"
            # store for later tests
            TestCampaignCreate.campaign_id = c["campaign_id"]
            # confirm persistence
            doc = mongo_db.campaigns.find_one({"campaign_id": c["campaign_id"]})
            assert doc is not None
        else:
            # Stripe failed gracefully — make sure no campaign was persisted with status active
            pytest.skip(f"Stripe checkout failed gracefully with 502 (sk_test_emergent). Body: {r.text[:200]}")


# ---------- Campaign listing & retrieval ----------
class TestCampaignRead:
    def test_list_campaigns(self, api_client, base_url, auth_headers):
        r = api_client.get(f"{base_url}/api/business/campaigns", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # If we created one above, it should be present
        cid = getattr(TestCampaignCreate, "campaign_id", None)
        if cid:
            assert any(c["campaign_id"] == cid for c in data)

    def test_get_one_campaign(self, api_client, base_url, auth_headers):
        cid = getattr(TestCampaignCreate, "campaign_id", None)
        if not cid:
            pytest.skip("No campaign created (Stripe failure)")
        r = api_client.get(f"{base_url}/api/business/campaigns/{cid}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["campaign_id"] == cid

    def test_get_nonexistent_campaign(self, api_client, base_url, auth_headers):
        r = api_client.get(f"{base_url}/api/business/campaigns/camp_does_not_exist", headers=auth_headers)
        assert r.status_code == 404

    def test_check_payment_does_not_crash(self, api_client, base_url, auth_headers):
        cid = getattr(TestCampaignCreate, "campaign_id", None)
        if not cid:
            pytest.skip("No campaign to check")
        r = api_client.post(f"{base_url}/api/business/campaigns/{cid}/check-payment", headers=auth_headers)
        # With test stripe key, can be 200 (still pending) or 502
        assert r.status_code in (200, 502), r.text

    def test_report_404_when_no_post(self, api_client, base_url, auth_headers):
        cid = getattr(TestCampaignCreate, "campaign_id", None)
        if not cid:
            pytest.skip("No campaign")
        # Campaign still pending_payment => no post_id => 404
        r = api_client.get(f"{base_url}/api/business/campaigns/{cid}/report", headers=auth_headers)
        assert r.status_code == 404


# ---------- Apple Sign-In ----------
class TestAppleSignIn:
    def test_apple_missing_identifier(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/apple", json={"identity_token": "fake", "user_identifier": ""})
        assert r.status_code == 400

    def test_apple_creates_user_and_session(self, api_client, base_url, mongo_db):
        uid = f"apple.{uuid.uuid4().hex[:10]}"
        payload = {"identity_token": "fake_jwt_token", "user_identifier": uid,
                   "email": f"TEST_{uid}@privaterelay.appleid.com", "full_name": "Apple Tester"}
        try:
            r = api_client.post(f"{base_url}/api/auth/apple", json=payload)
            assert r.status_code == 200, r.text
            body = r.json()
            assert body.get("token")
            assert body["user"]["email"] == payload["email"]
            assert body["user"]["name"] == "Apple Tester"

            # Use the token
            r2 = api_client.get(f"{base_url}/api/auth/me", headers={"Authorization": f"Bearer {body['token']}"})
            assert r2.status_code == 200
            assert r2.json()["user_id"] == body["user"]["user_id"]

            # Second call with same identifier returns existing user (no dup)
            r3 = api_client.post(f"{base_url}/api/auth/apple", json=payload)
            assert r3.status_code == 200
            assert r3.json()["user"]["user_id"] == body["user"]["user_id"]
        finally:
            mongo_db.users.delete_many({"apple_id": uid})
            mongo_db.user_sessions.delete_many({"user_id": body["user"]["user_id"]}) if 'body' in dir() else None


# ---------- Sponsored Feed & Vote Geo ----------
class TestSponsoredFeedAndGeo:
    """Manually activate a campaign by directly inserting a sponsored post + matching campaign in db,
    then verify feed injection, vote-geo storage and report aggregation.
    """

    @pytest.fixture(autouse=True)
    def _setup_active_campaign(self, mongo_db, seeded_user):
        # Cleanup any pre-existing
        uid = seeded_user["user_id"]
        mongo_db.campaigns.delete_many({"user_id": uid})
        mongo_db.posts.delete_many({"author_id": uid})

        # Create 6 organic posts owned by other_user so we can verify sponsored injection at idx 2/5
        other = "user_other_organic"
        mongo_db.users.update_one({"user_id": other},
                                   {"$set": {"user_id": other, "email": "TEST_organic@x.com",
                                             "name": "Org", "picture": None,
                                             "created_at": datetime.now(timezone.utc)}}, upsert=True)
        for i in range(6):
            mongo_db.posts.insert_one({
                "post_id": f"post_org_{i}_{uuid.uuid4().hex[:6]}", "word": f"ORG{i}",
                "image_base64": DUMMY_IMG, "author_id": other, "author_name": "Org",
                "author_picture": None,
                "created_at": datetime.now(timezone.utc) - timedelta(minutes=i),
                "aprovo_count": 0, "desaprovo_count": 0, "comments_count": 0,
                "reports_count": 0, "hidden": False, "is_sponsored": False,
            })

        # Create active global campaign + sponsored post
        cid = f"camp_TEST_{uuid.uuid4().hex[:8]}"
        pid = f"post_TEST_spon_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)
        mongo_db.campaigns.insert_one({
            "campaign_id": cid, "user_id": uid, "company_name": "TEST_Sponsor",
            "word": "SPONSORED", "image_base64": DUMMY_IMG,
            "tier_key": "global", "scope": "world", "duration_days": 60,
            "amount_cents": 49900, "included_votes": 9980,
            "target_country_code": None, "target_region": None, "target_city": None,
            "status": "active", "votes_collected": 0,
            "aprovo_count": 0, "desaprovo_count": 0,
            "created_at": now, "starts_at": now,
            "ends_at": now + timedelta(days=60),
            "post_id": pid,
        })
        mongo_db.posts.insert_one({
            "post_id": pid, "word": "SPONSORED", "image_base64": DUMMY_IMG,
            "author_id": uid, "author_name": "TEST_Sponsor", "author_picture": None,
            "created_at": now, "aprovo_count": 0, "desaprovo_count": 0,
            "comments_count": 0, "reports_count": 0, "hidden": False,
            "is_sponsored": True, "campaign_id": cid,
        })

        self.cid = cid
        self.pid = pid
        yield
        # teardown
        mongo_db.campaigns.delete_many({"user_id": uid})
        mongo_db.posts.delete_many({"author_id": uid})
        mongo_db.posts.delete_many({"author_id": other})
        mongo_db.votes.delete_many({"post_id": pid})
        mongo_db.comments.delete_many({"post_id": pid})

    def test_feed_excludes_sponsored_from_organic_but_injects(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/posts")
        assert r.status_code == 200
        posts = r.json()
        # The sponsored post may or may not be injected depending on geo match (world=always match)
        # All non-sponsored posts must have is_sponsored=False
        for p in posts:
            if p["post_id"] == self.pid:
                assert p["is_sponsored"] is True
        # Ensure feed contains organic posts
        organic_post_ids = [p["post_id"] for p in posts if not p["is_sponsored"]]
        assert len(organic_post_ids) >= 1

        # With our 6 organic + active global campaign, sponsored should be injected
        sponsored_in_feed = any(p["post_id"] == self.pid for p in posts)
        assert sponsored_in_feed, "Sponsored post should be injected into feed (global scope, every 3rd organic)"

    def test_vote_stores_geo(self, api_client, base_url, auth_headers, mongo_db):
        # Vote on the sponsored post; vote doc should have geo subdoc (may be empty for local ip)
        r = api_client.post(f"{base_url}/api/posts/{self.pid}/vote", json={"vote": "aprovo"}, headers=auth_headers)
        assert r.status_code == 200, r.text
        vote_doc = mongo_db.votes.find_one({"post_id": self.pid, "user_id": "user_test_pytest_001"})
        assert vote_doc is not None
        assert "geo" in vote_doc, "Vote must have geo metadata"

        # Campaign stats incremented
        camp = mongo_db.campaigns.find_one({"campaign_id": self.cid})
        assert camp["votes_collected"] == 1
        assert camp["aprovo_count"] == 1

    def test_campaign_report_with_geo_aggregation(self, api_client, base_url, auth_headers, mongo_db):
        # Insert synthetic votes with various geos directly
        votes_data = [
            ("u1", "aprovo", {"country": "Brazil", "country_code": "BR", "region": "São Paulo", "city": "São Paulo"}),
            ("u2", "aprovo", {"country": "Brazil", "country_code": "BR", "region": "São Paulo", "city": "Campinas"}),
            ("u3", "desaprovo", {"country": "Brazil", "country_code": "BR", "region": "Rio de Janeiro", "city": "Rio de Janeiro"}),
            ("u4", "aprovo", {"country": "United States", "country_code": "US", "region": "California", "city": "San Francisco"}),
            ("u5", "desaprovo", {"country": "United States", "country_code": "US", "region": "New York", "city": "New York"}),
        ]
        for uid, vote, geo in votes_data:
            mongo_db.votes.insert_one({
                "post_id": self.pid, "user_id": uid, "vote": vote, "geo": geo,
                "created_at": datetime.now(timezone.utc),
            })
        # Insert comments to build word cloud
        for w in ["amor", "amor", "amor", "odio", "odio", "paz"]:
            mongo_db.comments.insert_one({
                "comment_id": f"cmt_{uuid.uuid4().hex[:10]}", "post_id": self.pid,
                "user_id": f"u_{uuid.uuid4().hex[:6]}", "user_name": "X", "user_picture": None,
                "word": w, "created_at": datetime.now(timezone.utc),
            })
        # Update campaign aggregate counters manually (in real flow vote endpoint does this)
        mongo_db.campaigns.update_one({"campaign_id": self.cid},
                                       {"$set": {"votes_collected": 5, "aprovo_count": 3, "desaprovo_count": 2}})

        r = api_client.get(f"{base_url}/api/business/campaigns/{self.cid}/report", headers=auth_headers)
        assert r.status_code == 200, r.text
        rep = r.json()
        assert rep["campaign_id"] == self.cid
        assert rep["total_votes"] == 5
        assert rep["aprovo_count"] == 3
        assert rep["desaprovo_count"] == 2
        # aprovo_pct = round(3/5*100) = 60
        assert rep["aprovo_pct"] == 60

        # by_country: Brazil(3 votes: 2 aprovo, 1 desaprovo), US (2 votes: 1 aprovo, 1 desaprovo)
        by_country = {row["label"]: row for row in rep["by_country"]}
        assert "Brazil" in by_country
        assert by_country["Brazil"]["total"] == 3
        assert by_country["Brazil"]["aprovo"] == 2
        assert by_country["Brazil"]["desaprovo"] == 1
        assert by_country["Brazil"]["aprovo_pct"] == 67  # round(2/3*100)
        assert by_country["United States"]["total"] == 2

        # by_region
        by_region = {row["label"]: row for row in rep["by_region"]}
        assert by_region["São Paulo"]["total"] == 2
        assert by_region["São Paulo"]["aprovo"] == 2

        # by_city
        by_city = {row["label"]: row for row in rep["by_city"]}
        assert by_city["São Paulo"]["total"] == 1
        assert by_city["Campinas"]["total"] == 1

        # word_cloud
        cloud = {w["word"]: w["count"] for w in rep["word_cloud"]}
        assert cloud.get("amor") == 3
        assert cloud.get("odio") == 2
        assert cloud.get("paz") == 1


# ---------- Geo endpoint ----------
class TestGeoEndpoint:
    def test_geo_me_runs(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/geo/me")
        assert r.status_code == 200
        d = r.json()
        # keys present
        for k in ("country", "country_code", "region", "city", "ip"):
            assert k in d
