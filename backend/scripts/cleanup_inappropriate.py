#!/usr/bin/env python3
"""
Remove or hide inappropriate seed/test content from MongoDB.
Run: cd backend && source venv/bin/activate && python scripts/cleanup_inappropriate.py
"""

import asyncio
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

from dotenv import load_dotenv
load_dotenv(ROOT_DIR / ".env")

from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ["MONGO_URL"]
if "mongodb.net" in MONGO_URL and "tlsAllowInvalidCertificates" not in MONGO_URL:
    sep = "&" if "?" in MONGO_URL else "?"
    extra = "tlsAllowInvalidCertificates=true"
    if "retryWrites" not in MONGO_URL:
        extra += "&retryWrites=true"
    if "w=majority" not in MONGO_URL:
        extra += "&w=majority"
    MONGO_URL = f"{MONGO_URL}{sep}{extra}"

client = AsyncIOMotorClient(MONGO_URL)
db = client[os.environ["DB_NAME"]]

# Words that should be hidden/deleted from the feed
INAPPROPRIATE_WORDS = [
    "ALIMENTAR",
    "ONIBUS",
    "ÔNIBUS",
    "BUS",
]

# Event name fragments to delete
INAPPROPRIATE_EVENT_FRAGMENTS = [
    "ônibus",
    "Ônibus",
    "onibus",
    "ÔNIBUS",
]


async def cleanup():
    print("=== Besord — Limpeza de Conteúdo Inapropriado ===\n")

    # 1. Hide posts with inappropriate words
    print("1. Posts com palavras inapropriadas:")
    for word in INAPPROPRIATE_WORDS:
        posts = await db.posts.find(
            {"word": word, "hidden": {"$ne": True}}, {"post_id": 1, "word": 1, "author_id": 1}
        ).to_list(length=100)
        if not posts:
            print(f"   ✅ Nenhum post com '{word}'")
            continue
        for p in posts:
            await db.posts.update_one(
                {"post_id": p["post_id"]},
                {"$set": {"hidden": True}}
            )
            print(f"   🚫 Ocultado post '{p['word']}' (id={p['post_id']}, autor={p['author_id']})")

    # 2. Delete test user posts entirely (tester.a / tester.b accounts)
    print("\n2. Posts de utilizadores de teste (tester.a / tester.b):")
    test_users = await db.users.find(
        {"email": {"$regex": "^tester\\.(a|b)\\.", "$options": "i"}},
        {"user_id": 1, "email": 1}
    ).to_list(length=50)

    if not test_users:
        print("   ✅ Nenhum utilizador de teste encontrado")
    for u in test_users:
        deleted = await db.posts.delete_many({"author_id": u["user_id"]})
        deleted_votes = await db.votes.delete_many({"user_id": u["user_id"]})
        deleted_user = await db.users.delete_one({"user_id": u["user_id"]})
        print(f"   🗑  {u['email']}: {deleted.deleted_count} posts, {deleted_votes.deleted_count} votos, utilizador {'removido' if deleted_user.deleted_count else 'já removido'}")

    # 3. Delete events with inappropriate names
    print("\n3. Eventos com nomes inapropriados:")
    for fragment in INAPPROPRIATE_EVENT_FRAGMENTS:
        events = await db.events.find(
            {"$or": [
                {"title": {"$regex": fragment, "$options": "i"}},
                {"description": {"$regex": fragment, "$options": "i"}},
            ]},
            {"event_id": 1, "title": 1}
        ).to_list(length=50)
        for ev in events:
            await db.events.delete_one({"event_id": ev["event_id"]})
            print(f"   🗑  Evento removido: '{ev.get('title', '?')}' (id={ev['event_id']})")

    remaining = await db.events.find_one({
        "$or": [
            {"title": {"$regex": "nibus", "$options": "i"}},
            {"description": {"$regex": "nibus", "$options": "i"}},
        ]
    })
    if not remaining:
        print("   ✅ Nenhum evento inapropriado encontrado")

    # 4. Show summary of current feed
    print("\n4. Sumário do feed actual:")
    total_posts = await db.posts.count_documents({"hidden": {"$ne": True}})
    hidden_posts = await db.posts.count_documents({"hidden": True})
    total_events = await db.events.count_documents({})
    print(f"   Posts visíveis: {total_posts}")
    print(f"   Posts ocultos:  {hidden_posts}")
    print(f"   Eventos:        {total_events}")

    print("\n✅ Limpeza concluída.")


if __name__ == "__main__":
    asyncio.run(cleanup())
