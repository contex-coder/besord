"""
Cleanup script for Besord — remove test/debug artifacts that polluted real user accounts.

Removes:
- Workspaces whose name matches obvious test patterns (e.g. "Teste Teste", "Old Co", "TEST_")
- business_profile fields with the same patterns
- Soft-deletes test campaigns
- Optionally: prune draft / pending_payment campaigns older than 7 days

Safe to re-run (idempotent). Never deletes the personal workspace.

Usage:
    python /app/backend/scripts/cleanup_test_data.py [--dry]
"""
import asyncio
import os
import re
import sys
from datetime import datetime, timezone, timedelta

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(ROOT, ".env"))

# Patterns considered "test data" (case-insensitive)
TEST_NAME_PATTERNS = [
    re.compile(r"^teste\s+teste$", re.I),
    re.compile(r"^test_", re.I),
    re.compile(r"^old\s+co$", re.I),
    re.compile(r"^company\s*[a-z]?$", re.I),
    re.compile(r"^lorem", re.I),
    re.compile(r"^empresa\s+x$", re.I),
    re.compile(r"^empresa\s+y$", re.I),
]


def looks_like_test(name: str) -> bool:
    if not name:
        return False
    n = name.strip()
    return any(p.match(n) for p in TEST_NAME_PATTERNS)


async def main(dry: bool = False) -> None:
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ.get("DB_NAME", "besord")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    print(f"\n📦 DB: {db_name}    DRY={dry}\n")

    # 1) Workspaces
    cursor = db.workspaces.find(
        {"deleted_at": {"$exists": False}, "type": "business"}, {"_id": 0}
    )
    ws_targets = []
    async for w in cursor:
        if looks_like_test(w.get("name", "")):
            ws_targets.append(w)
    print(f"🏢 Test workspaces matched: {len(ws_targets)}")
    for w in ws_targets:
        print(f"   → {w['workspace_id']}  ({w['name']!r})  owner={w['owner_user_id']}")
    if not dry and ws_targets:
        ids = [w["workspace_id"] for w in ws_targets]
        r = await db.workspaces.update_many(
            {"workspace_id": {"$in": ids}},
            {"$set": {"deleted_at": datetime.now(timezone.utc),
                       "deleted_reason": "cleanup_test_data"}},
        )
        print(f"   ✅ soft-deleted {r.modified_count}")

    # 2) business_profile in users
    cursor = db.users.find({"business_profile.company_name": {"$exists": True}},
                            {"user_id": 1, "business_profile": 1, "email": 1, "_id": 0})
    bp_targets = []
    async for u in cursor:
        name = (u.get("business_profile") or {}).get("company_name", "")
        if looks_like_test(name):
            bp_targets.append(u)
    print(f"\n👤 Users with test business_profile: {len(bp_targets)}")
    for u in bp_targets:
        print(f"   → {u['email']}  ({u['business_profile']['company_name']!r})")
    if not dry and bp_targets:
        ids = [u["user_id"] for u in bp_targets]
        r = await db.users.update_many(
            {"user_id": {"$in": ids}},
            {"$unset": {"business_profile": ""}},
        )
        print(f"   ✅ unset business_profile for {r.modified_count}")

    # 3) Pending campaigns older than 7 days (never paid)
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    n_pending = await db.campaigns.count_documents({
        "status": "pending_payment",
        "created_at": {"$lt": cutoff},
    })
    print(f"\n🧾 Pending campaigns older than 7d: {n_pending}")
    if not dry and n_pending:
        r = await db.campaigns.delete_many({
            "status": "pending_payment",
            "created_at": {"$lt": cutoff},
        })
        print(f"   ✅ deleted {r.deleted_count}")

    # 4) Test users that obviously look like seeded ones (do NOT delete — just report)
    test_user_count = await db.users.count_documents({
        "$or": [
            {"email": re.compile(r"@besord\.test$", re.I)},
            {"email": re.compile(r"@example\.com$", re.I)},
            {"name": re.compile(r"^TEST_", re.I)},
        ]
    })
    print(f"\n🧪 Users that look like test accounts (not deleted): {test_user_count}")

    print("\nDone.\n")
    client.close()


if __name__ == "__main__":
    dry = "--dry" in sys.argv or "-n" in sys.argv
    asyncio.run(main(dry=dry))
