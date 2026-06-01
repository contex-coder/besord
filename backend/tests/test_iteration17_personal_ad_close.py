"""
Iteration 17 — Personal Ad Auto-close + Notification (Task 2)

Validates:
- When a personal ad's votes_collected reaches included_votes (the cap):
  * the ad is auto-marked status="completed"
  * the underlying post loses is_sponsored=True
  * an in-app notification is inserted
- The behaviour is idempotent (extra votes after closure are gracefully ignored)
"""
import pytest
from datetime import datetime, timezone, timedelta


def _seed_personal_ad(mongo_db, user_id, votes_already=0, cap=3):
    """Create a personal_ads doc + a sponsored post pointing to it."""
    now = datetime.now(timezone.utc)
    ad_id = f"pad_close_{int(now.timestamp() * 1000)}"
    post_id = f"p_close_{int(now.timestamp() * 1000)}"
    mongo_db.posts.delete_many({"post_id": post_id})
    mongo_db.personal_ads.delete_many({"personal_ad_id": ad_id})
    mongo_db.posts.insert_one({
        "post_id": post_id, "author_id": user_id, "word": "CAPTEST",
        "image_base64": "data:image/jpeg;base64,AAAA", "created_at": now,
        "aprovo_count": 0, "desaprovo_count": 0,
        "is_sponsored": True, "personal_ad_id": ad_id, "campaign_id": ad_id,
        "starts_at": now, "ends_at": now + timedelta(days=1),
    })
    mongo_db.personal_ads.insert_one({
        "personal_ad_id": ad_id, "user_id": user_id, "tier_key": "mini",
        "tier_name": "MINI", "scope": "city", "duration_days": 1, "bw_cost": 100,
        "included_votes": cap,
        "target_country_code": "PT", "target_region": None, "target_city": "Lisbon",
        "post_id": post_id, "status": "active",
        "starts_at": now, "ends_at": now + timedelta(days=1), "created_at": now,
        "aprovo_count": 0, "desaprovo_count": 0,
        "votes_collected": int(votes_already),
    })
    return ad_id, post_id


class TestPersonalAdAutoClose:
    def test_vote_below_cap_keeps_ad_active(self, base_url, mongo_db, seeded_user, auth_headers, api_client):
        # cap=3, only 1 vote -> still active
        ad_id, post_id = _seed_personal_ad(mongo_db, seeded_user["user_id"], votes_already=0, cap=3)
        # vote as a *different* user (we just need 1 vote registered)
        other_id = "u_voter_below"
        mongo_db.users.delete_one({"user_id": other_id})
        mongo_db.users.insert_one({"user_id": other_id, "email": "voterB@b.com", "name": "VB", "bw_balance": 0, "bw_total_earned": 0})
        # Insert a session for this voter
        from datetime import datetime, timezone, timedelta
        tok = f"sess_below_{other_id}"
        mongo_db.user_sessions.delete_many({"user_id": other_id})
        mongo_db.user_sessions.insert_one({"session_token": tok, "user_id": other_id,
                                           "expires_at": datetime.now(timezone.utc) + timedelta(days=1)})
        r = api_client.post(f"{base_url}/api/posts/{post_id}/vote",
                            headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
                            json={"vote": "aprovo"})
        assert r.status_code == 200, r.text
        ad = mongo_db.personal_ads.find_one({"personal_ad_id": ad_id})
        assert ad["status"] == "active"
        assert ad["votes_collected"] == 1
        post = mongo_db.posts.find_one({"post_id": post_id})
        assert post["is_sponsored"] is True

    def test_vote_hits_cap_completes_and_notifies(self, base_url, mongo_db, seeded_user, auth_headers, api_client):
        # cap=2, already 1 vote -> next vote hits the cap (=2)
        ad_id, post_id = _seed_personal_ad(mongo_db, seeded_user["user_id"], votes_already=1, cap=2)
        mongo_db.posts.update_one({"post_id": post_id}, {"$set": {"aprovo_count": 1}})
        mongo_db.personal_ads.update_one({"personal_ad_id": ad_id}, {"$set": {"aprovo_count": 1}})

        other_id = "u_voter_cap"
        mongo_db.users.delete_one({"user_id": other_id})
        mongo_db.users.insert_one({"user_id": other_id, "email": "voterC@b.com", "name": "VC", "bw_balance": 0, "bw_total_earned": 0})
        from datetime import datetime, timezone, timedelta
        tok = f"sess_cap_{other_id}"
        mongo_db.user_sessions.delete_many({"user_id": other_id})
        mongo_db.user_sessions.insert_one({"session_token": tok, "user_id": other_id,
                                           "expires_at": datetime.now(timezone.utc) + timedelta(days=1)})
        # Also clear any old notifs to avoid leak
        mongo_db.notifications.delete_many({"user_id": seeded_user["user_id"], "type": "personal_ad_completed", "personal_ad_id": ad_id})

        r = api_client.post(f"{base_url}/api/posts/{post_id}/vote",
                            headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
                            json={"vote": "desaprovo"})
        assert r.status_code == 200, r.text

        ad = mongo_db.personal_ads.find_one({"personal_ad_id": ad_id})
        assert ad["status"] == "completed", f"ad not completed: {ad}"
        assert ad.get("completion_reason") == "cap_reached"
        assert ad["votes_collected"] == 2

        # Post must no longer be sponsored
        post = mongo_db.posts.find_one({"post_id": post_id})
        assert post.get("is_sponsored") is False
        assert post.get("campaign_id") is None

        # Notification must be created for the AD OWNER (not the voter)
        notif = mongo_db.notifications.find_one({
            "user_id": seeded_user["user_id"],
            "personal_ad_id": ad_id,
            "type": "personal_ad_completed",
        })
        assert notif is not None
        assert "concluído" in notif["title"].lower() or "300" in notif["title"] or "2" in notif["title"]
        assert notif["payload"]["votes_collected"] == 2
        assert notif["payload"]["aprovo_pct"] == 50  # 1 aprovo, 1 desaprovo
