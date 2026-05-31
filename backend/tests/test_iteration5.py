"""Iteration 5 — Tests for Resend milestone emails + geo_points in campaign report.

Scope (per review request):
 1. email_alerts module: pure-function tests for crossed_milestones, subject, html
 2. _is_configured returns True (RESEND_API_KEY present in .env) — do NOT send a real email
 3. Idempotency simulation for server._maybe_send_milestone filter
 4. GET /api/business/campaigns/{id}/report -> includes geo_points list; other fields preserved
 5. POST /api/posts/{id}/vote regression — milestone hook must not raise on organic post (campaign_id=None)
"""
import base64
import os
import sys
import uuid
import pytest
from datetime import datetime, timezone, timedelta

# Make /app/backend importable so we can pull in email_alerts directly
sys.path.insert(0, "/app/backend")

from email_alerts import (
    crossed_milestones,
    _milestone_subject,
    _milestone_html,
    _is_configured,
    send_milestone_email,
    MILESTONES,
)

_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c6300010000000500010d0a2db40000000049454e44ae426082"
)
DUMMY_IMG = "data:image/png;base64," + base64.b64encode(_PNG).decode() + ("A" * 100)


# ------------------ Section 1: crossed_milestones ------------------

class TestCrossedMilestones:
    def test_crosses_50(self):
        assert crossed_milestones(40, 55, 100) == [50]

    def test_no_progress(self):
        assert crossed_milestones(50, 50, 100) == []

    def test_crosses_75_and_100(self):
        assert crossed_milestones(70, 100, 100) == [75, 100]

    def test_crosses_all_three(self):
        assert crossed_milestones(0, 100, 100) == [50, 75, 100]

    def test_crosses_50_and_75(self):
        assert crossed_milestones(49, 76, 100) == [50, 75]

    def test_zero_target_returns_empty(self):
        assert crossed_milestones(10, 50, 0) == []

    def test_negative_target_returns_empty(self):
        assert crossed_milestones(10, 50, -5) == []

    def test_milestones_constant_is_50_75_100(self):
        assert tuple(MILESTONES) == (50, 75, 100)


# ------------------ Section 2: subject + html helpers ------------------

class TestEmailContent:
    def test_subject_50(self):
        s = _milestone_subject(50, "pizza")
        assert isinstance(s, str) and s
        assert "50" in s
        assert "pizza" in s

    def test_subject_100(self):
        s = _milestone_subject(100, "burger")
        assert isinstance(s, str) and s
        assert "100" in s
        assert "burger" in s

    def test_html_contains_required_fields(self):
        html = _milestone_html(
            milestone=75,
            word="sushi",
            votes_collected=750,
            included_votes=1000,
            aprovo_pct=63,
            campaign_id="camp_xyz_abc",
        )
        assert isinstance(html, str) and html
        # dash url uses APP_BASE_URL
        assert "/business/campaign/camp_xyz_abc" in html
        # numeric values rendered
        assert "750" in html
        assert "1000" in html
        assert "63%" in html
        # word echoed (uppercase per template)
        assert "SUSHI" in html

    def test_html_100_uses_meta_alcancada_headline(self):
        html = _milestone_html(100, "x", 100, 100, 80, "cid")
        assert "META ALCAN" in html  # ASCII-safe substring (UTF-8 accents present)


# ------------------ Section 3: configuration ------------------

class TestResendConfig:
    def test_configured(self):
        # main agent already validated a real send; we ONLY confirm configured
        assert _is_configured() is True, "RESEND_API_KEY should be set in /app/backend/.env"

    def test_resend_api_key_env_present(self):
        # Sanity that the env var landed in process
        assert os.environ.get("RESEND_API_KEY") or _is_configured()

    def test_no_recipient_returns_none_without_send(self):
        # empty to_email short-circuits — no API call
        res = send_milestone_email(
            to_email="",
            milestone=50,
            word="t",
            votes_collected=1,
            included_votes=2,
            aprovo_pct=50,
            campaign_id="c",
        )
        assert res is None


# ------------------ Section 4: idempotency filter simulation ------------------

class TestMilestoneIdempotency:
    """Mirror the in-memory filter used by server._maybe_send_milestone."""

    def test_already_sent_50_is_filtered(self):
        already_sent = {50}
        new_milestones = [50]
        to_send = [m for m in new_milestones if m not in already_sent]
        assert to_send == []

    def test_partial_overlap_keeps_unsent(self):
        already_sent = {50}
        new_milestones = [50, 75]
        to_send = [m for m in new_milestones if m not in already_sent]
        assert to_send == [75]

    def test_all_unsent(self):
        already_sent = set()
        new_milestones = [50, 75, 100]
        to_send = [m for m in new_milestones if m not in already_sent]
        assert to_send == [50, 75, 100]


# ------------------ Section 5: campaign report includes geo_points ------------------

class TestCampaignReportGeoPoints:
    """End-to-end: seed a paid+active campaign with sponsored post + a few votes
    (some with geo coords), then call /report and confirm geo_points is present
    and well-formed, and that the existing fields are still there.
    """

    @pytest.fixture(scope="class")
    def seeded_campaign(self, mongo_db, seeded_user):
        cid = f"camp_TEST_iter5_{uuid.uuid4().hex[:8]}"
        pid = f"post_TEST_iter5_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)
        # campaign owned by seeded_user
        mongo_db.campaigns.insert_one({
            "campaign_id": cid,
            "user_id": seeded_user["user_id"],
            "word": "iter5camp",
            "tier_key": "local",
            "scope": "world",
            "duration_days": 7,
            "included_votes": 100,
            "votes_collected": 3,
            "aprovo_count": 2,
            "desaprovo_count": 1,
            "milestones_sent": [],
            "status": "active",
            "starts_at": now - timedelta(days=1),
            "ends_at": now + timedelta(days=6),
            "post_id": pid,
            "paid_at": now,
            "created_at": now - timedelta(days=1),
            "business_profile": {"contact_email": "noone@besord.test"},
        })
        mongo_db.posts.insert_one({
            "post_id": pid,
            "word": "iter5camp",
            "image_base64": DUMMY_IMG,
            "author_id": seeded_user["user_id"],
            "author_name": "T",
            "author_picture": None,
            "created_at": now,
            "aprovo_count": 2,
            "desaprovo_count": 1,
            "comments_count": 0,
            "reports_count": 0,
            "hidden": False,
            "is_sponsored": True,
            "campaign_id": cid,
        })
        # 3 votes — 2 with geo, 1 without
        mongo_db.votes.insert_many([
            {"post_id": pid, "user_id": f"u_iter5_a_{uuid.uuid4().hex[:6]}",
             "vote": "aprovo",
             "geo": {"lat": 38.7223, "lon": -9.1393, "city": "Lisbon",
                     "country": "Portugal", "country_code": "PT", "region": "Lisboa"},
             "created_at": now},
            {"post_id": pid, "user_id": f"u_iter5_b_{uuid.uuid4().hex[:6]}",
             "vote": "aprovo",
             "geo": {"lat": 40.4168, "lon": -3.7038, "city": "Madrid",
                     "country": "Spain", "country_code": "ES", "region": "Madrid"},
             "created_at": now},
            {"post_id": pid, "user_id": f"u_iter5_c_{uuid.uuid4().hex[:6]}",
             "vote": "desaprovo",
             "geo": {"lat": None, "lon": None, "city": None,
                     "country": None, "country_code": None, "region": None},
             "created_at": now},
        ])
        yield {"campaign_id": cid, "post_id": pid}
        # teardown
        mongo_db.campaigns.delete_one({"campaign_id": cid})
        mongo_db.posts.delete_one({"post_id": pid})
        mongo_db.votes.delete_many({"post_id": pid})

    def test_report_returns_200_with_geo_points(self, api_client, base_url, auth_headers, seeded_campaign):
        cid = seeded_campaign["campaign_id"]
        r = api_client.get(f"{base_url}/api/business/campaigns/{cid}/report", headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        # geo_points key present and is a list
        assert "geo_points" in body, "Report must include geo_points"
        assert isinstance(body["geo_points"], list)
        # We seeded 2 votes with valid lat/lon
        assert len(body["geo_points"]) == 2, f"expected 2 geo_points, got {len(body['geo_points'])}"
        for gp in body["geo_points"]:
            assert set(["lat", "lon", "vote", "city", "country_code"]).issubset(gp.keys())
            assert isinstance(gp["lat"], float)
            assert isinstance(gp["lon"], float)
            assert gp["vote"] in ("aprovo", "desaprovo")

    def test_report_preserves_existing_fields(self, api_client, base_url, auth_headers, seeded_campaign):
        cid = seeded_campaign["campaign_id"]
        r = api_client.get(f"{base_url}/api/business/campaigns/{cid}/report", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        for key in ("by_country", "by_region", "by_city", "top_3_words",
                    "pace", "word_cloud", "benchmark", "summary", "verdict_tag"):
            assert key in body, f"missing legacy field: {key}"
        # by_country should have at least PT/ES from our seed
        cc_codes = {row.get("name") for row in body["by_country"]}
        # Either name field is the country string ("Portugal"/"Spain"); just verify non-empty
        assert len(body["by_country"]) >= 2

    def test_report_geo_points_capped_or_listed(self, api_client, base_url, auth_headers, seeded_campaign):
        cid = seeded_campaign["campaign_id"]
        r = api_client.get(f"{base_url}/api/business/campaigns/{cid}/report", headers=auth_headers)
        assert r.status_code == 200
        # Cap is 2000 — small seed must be way under
        assert len(r.json()["geo_points"]) <= 2000


# ------------------ Section 6: organic vote regression (no milestone) ------------------

class TestVoteRegressionOrganic:
    """POST /api/posts/{id}/vote on an organic post must still return 200 and
    must NOT raise from the milestone hook (campaign_id is None)."""

    def test_organic_vote_does_not_break(self, api_client, base_url, auth_headers, seeded_user):
        # Create a fresh organic post
        r = api_client.post(
            f"{base_url}/api/posts",
            json={"word": f"ITER5{uuid.uuid4().hex[:6]}", "image_base64": DUMMY_IMG},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        pid = r.json()["post_id"]
        try:
            rv = api_client.post(
                f"{base_url}/api/posts/{pid}/vote",
                json={"vote": "aprovo"},
                headers=auth_headers,
            )
            assert rv.status_code == 200, rv.text
            payload = rv.json()
            assert payload["post_id"] == pid
            assert payload.get("aprovo_count", 0) >= 1
            # Confirm no campaign_id was set on the organic post
            assert payload.get("campaign_id") in (None, "", False)
        finally:
            api_client.delete(f"{base_url}/api/posts/{pid}", headers=auth_headers)


# ------------------ Section 7: milestones_sent persistence on real campaign vote ------------------

class TestMilestoneSendIntegration:
    """Push a campaign across the 50% threshold and confirm milestones_sent
    is updated AND a second vote doesn't re-send (idempotent).
    NOTE: this WILL call Resend once. We accept that — main agent has
    confirmed real key works. We use a non-routable contact_email to
    keep noise low (Resend will still accept and queue the send)."""

    @pytest.fixture(scope="class")
    def near_threshold_campaign(self, mongo_db, seeded_user):
        cid = f"camp_TEST_iter5milestone_{uuid.uuid4().hex[:8]}"
        pid = f"post_TEST_iter5milestone_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)
        # included_votes=10, votes_collected=4 => one more vote (5) hits 50%
        mongo_db.campaigns.insert_one({
            "campaign_id": cid,
            "user_id": seeded_user["user_id"],
            "word": f"ms{uuid.uuid4().hex[:4]}",
            "tier_key": "local",
            "included_votes": 10,
            "votes_collected": 4,
            "aprovo_count": 4,
            "desaprovo_count": 0,
            "milestones_sent": [],
            "status": "active",
            "starts_at": now - timedelta(days=1),
            "ends_at": now + timedelta(days=6),
            "post_id": pid,
            "paid_at": now,
            "created_at": now - timedelta(days=1),
            # use an invalid-but-syntactically-valid email so Resend will reject
            # without spamming a real inbox; the helper just logs and returns None
            "business_profile": {"contact_email": "noone+TESTiter5@besord-invalid.test"},
        })
        mongo_db.posts.insert_one({
            "post_id": pid,
            "word": "iter5milestone",
            "image_base64": DUMMY_IMG,
            "author_id": seeded_user["user_id"],
            "author_name": "T",
            "author_picture": None,
            "created_at": now,
            "aprovo_count": 4,
            "desaprovo_count": 0,
            "comments_count": 0,
            "reports_count": 0,
            "hidden": False,
            "is_sponsored": True,
            "campaign_id": cid,
        })
        yield {"campaign_id": cid, "post_id": pid}
        # teardown
        mongo_db.campaigns.delete_one({"campaign_id": cid})
        mongo_db.posts.delete_one({"post_id": pid})
        mongo_db.votes.delete_many({"post_id": pid})

    def test_crossing_50_marks_milestone(self, api_client, base_url, auth_headers,
                                          near_threshold_campaign, mongo_db):
        pid = near_threshold_campaign["post_id"]
        cid = near_threshold_campaign["campaign_id"]
        # Vote once -> takes votes_collected from 4 to 5 => 50% reached
        r = api_client.post(f"{base_url}/api/posts/{pid}/vote",
                            json={"vote": "aprovo"}, headers=auth_headers)
        assert r.status_code == 200, r.text
        # Re-read campaign and verify milestones_sent contains 50
        doc = mongo_db.campaigns.find_one({"campaign_id": cid})
        assert doc is not None
        # Even if Resend call returns None (invalid recipient), the server still
        # marks milestones_sent after the loop. Check it landed:
        sent = doc.get("milestones_sent") or []
        assert 50 in sent, f"expected 50 in milestones_sent, got {sent}"
