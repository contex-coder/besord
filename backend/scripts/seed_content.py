#!/usr/bin/env python3
"""
Seed 50 posts curados pela conta @besord para o feed global.
Execução: cd backend && source venv/bin/activate && python scripts/seed_content.py

Regras do Filtro Besord para as imagens (imutáveis):
  1. Sem texto na imagem
  2. Sem performance (sem poses de selfie ou venda directa)
  3. Espaço de respiro (pelo menos 20% de área sem elemento focal)

Fontes: Unsplash (licence gratuita para uso comercial e editorial)
"""

import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
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

BESORD_USER_ID = "besord_editorial"
BESORD_NAME = "Besord"
BESORD_AVATAR = None

# 50 posts seed — imagens Unsplash (públicas, sem texto, sem pessoas em pose)
# Distribuídas pelos arquétipos do Filtro Besord
SEED_POSTS = [
    # Contraste Ético (10)
    {"word": "SILÊNCIO",    "image": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80", "theme": None},
    {"word": "VAZIO",       "image": "https://images.unsplash.com/photo-1454391304352-2bf4678b1a7a?w=800&q=80", "theme": None},
    {"word": "FRONTEIRA",   "image": "https://images.unsplash.com/photo-1445991842772-097fea258e7b?w=800&q=80", "theme": None},
    {"word": "PESO",        "image": "https://images.unsplash.com/photo-1509909756405-be0199881695?w=800&q=80", "theme": None},
    {"word": "RUPTURA",     "image": "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800&q=80", "theme": None},
    {"word": "ESPERA",      "image": "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=800&q=80", "theme": None},
    {"word": "ABANDONO",    "image": "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80", "theme": None},
    {"word": "EXCESSO",     "image": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80", "theme": None},
    {"word": "LIMITE",      "image": "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80", "theme": None},
    {"word": "CONTRADIÇÃO", "image": "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80", "theme": None},

    # Minimalismo de Detalhe (10)
    {"word": "EXACTO",      "image": "https://images.unsplash.com/photo-1493723843671-1d655e66ac1c?w=800&q=80", "theme": None},
    {"word": "FOCO",        "image": "https://images.unsplash.com/photo-1515615575935-de40c3f21b48?w=800&q=80", "theme": None},
    {"word": "DETALHE",     "image": "https://images.unsplash.com/photo-1518050947974-4be8c7469f0c?w=800&q=80", "theme": None},
    {"word": "PAUSA",       "image": "https://images.unsplash.com/photo-1485470733090-0aae1788d5af?w=800&q=80", "theme": None},
    {"word": "ORDEM",       "image": "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800&q=80", "theme": None},
    {"word": "ESTRUTURA",   "image": "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80", "theme": None},
    {"word": "LINHA",       "image": "https://images.unsplash.com/photo-1476900966873-ab870b506c79?w=800&q=80", "theme": None},
    {"word": "RITMO",       "image": "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&q=80", "theme": None},
    {"word": "PROPORÇÃO",   "image": "https://images.unsplash.com/photo-1519638399535-1b036603ac77?w=800&q=80", "theme": None},
    {"word": "EQUILÍBRIO",  "image": "https://images.unsplash.com/photo-1511300636408-a63a89df3482?w=800&q=80", "theme": None},

    # Natureza Brutal (10)
    {"word": "FORÇA",       "image": "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80", "theme": None},
    {"word": "RAIZ",        "image": "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80", "theme": None},
    {"word": "TEMPESTADE",  "image": "https://images.unsplash.com/photo-1464039397811-476f652a343b?w=800&q=80", "theme": None},
    {"word": "CRESCIMENTO", "image": "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800&q=80", "theme": None},
    {"word": "PERSISTÊNCIA","image": "https://images.unsplash.com/photo-1530508777238-14544088c3ed?w=800&q=80", "theme": None},
    {"word": "EROSÃO",      "image": "https://images.unsplash.com/photo-1434725039720-aaad6dd32dfe?w=800&q=80", "theme": None},
    {"word": "FLUXO",       "image": "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800&q=80", "theme": None},
    {"word": "PRESSÃO",     "image": "https://images.unsplash.com/photo-1444464666168-49d633b86797?w=800&q=80", "theme": None},
    {"word": "SELVAGEM",    "image": "https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=800&q=80", "theme": None},
    {"word": "RESISTÊNCIA", "image": "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80", "theme": None},

    # Solidão Conectada (10)
    {"word": "INTROSPECÇÃO","image": "https://images.unsplash.com/photo-1541710430735-5fca14c95b00?w=800&q=80", "theme": None},
    {"word": "DISTÂNCIA",   "image": "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80", "theme": None},
    {"word": "ISOLAMENTO",  "image": "https://images.unsplash.com/photo-1490641815614-05d9b4c0bea0?w=800&q=80", "theme": None},
    {"word": "REFLEXÃO",    "image": "https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?w=800&q=80", "theme": None},
    {"word": "CONTEMPLAÇÃO","image": "https://images.unsplash.com/photo-1501446529957-6226b99af81e?w=800&q=80", "theme": None},
    {"word": "PRESENÇA",    "image": "https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?w=800&q=80", "theme": None},
    {"word": "INTERIOR",    "image": "https://images.unsplash.com/photo-1499002238440-d264edd596ec?w=800&q=80", "theme": None},
    {"word": "AUSÊNCIA",    "image": "https://images.unsplash.com/photo-1523712999610-f77fbcfc3843?w=800&q=80", "theme": None},
    {"word": "MEMÓRIA",     "image": "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=800&q=80", "theme": None},
    {"word": "SAUDADE",     "image": "https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=800&q=80", "theme": None},

    # Tempo & Passagem (10)
    {"word": "TRANSIÇÃO",   "image": "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80", "theme": None},
    {"word": "PASSAGEM",    "image": "https://images.unsplash.com/photo-1472120435266-53107fd0c44a?w=800&q=80", "theme": None},
    {"word": "DURABILIDADE","image": "https://images.unsplash.com/photo-1518005068251-37900150dfca?w=800&q=80", "theme": None},
    {"word": "URGÊNCIA",    "image": "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80", "theme": None},
    {"word": "FRAGMENTO",   "image": "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80", "theme": None},
    {"word": "INSTANTE",    "image": "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=800&q=80", "theme": None},
    {"word": "PERMANÊNCIA", "image": "https://images.unsplash.com/photo-1494500764479-0c8f2919a3d8?w=800&q=80", "theme": None},
    {"word": "CICLO",       "image": "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=800&q=80", "theme": None},
    {"word": "DECLÍNIO",    "image": "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=800&q=80", "theme": None},
    {"word": "RECOMEÇO",    "image": "https://images.unsplash.com/photo-1502481851512-e9e2529bfbf9?w=800&q=80", "theme": None},
]

async def ensure_besord_user():
    existing = await db.users.find_one({"user_id": BESORD_USER_ID})
    if not existing:
        await db.users.insert_one({
            "user_id": BESORD_USER_ID,
            "email": "editorial@besord.app",
            "name": BESORD_NAME,
            "avatar": BESORD_AVATAR,
            "auth_provider": "internal",
            "bw_balance": 0,
            "bw_total_earned": 0,
            "daily_interactions": {"count": 0, "reset_date": ""},
            "admirers_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        print("✅ Conta @besord criada")
    else:
        print("ℹ️  Conta @besord já existe")

async def seed():
    await ensure_besord_user()

    existing = await db.posts.count_documents({"author_id": BESORD_USER_ID})
    if existing >= len(SEED_POSTS):
        print(f"ℹ️  Já existem {existing} posts seed. Nada a fazer.")
        return

    # Publicar distribuídos pelas últimas 2 semanas (para o feed ter variedade temporal)
    now = datetime.now(timezone.utc)
    created_count = 0

    for i, seed_post in enumerate(SEED_POSTS):
        post_id = f"seed_{uuid.uuid4().hex[:12]}"
        hours_ago = (len(SEED_POSTS) - i) * 6  # 6h entre cada post
        created_at = now - timedelta(hours=hours_ago)

        existing_word = await db.posts.find_one({"author_id": BESORD_USER_ID, "word": seed_post["word"]})
        if existing_word:
            print(f"  ⏭  '{seed_post['word']}' já existe, a saltar")
            continue

        doc = {
            "post_id": post_id,
            "author_id": BESORD_USER_ID,
            "author_name": BESORD_NAME,
            "author_picture": BESORD_AVATAR,
            "word": seed_post["word"],
            "media": [{"type": "image", "url": seed_post["image"]}],
            "vote_count": {"aprovo": 0, "desaprovo": 0},
            "aprovo_count": 0,
            "desaprovo_count": 0,
            "hype": 0,
            "hype_score": 0,
            "theme": seed_post.get("theme"),
            "is_hype": False,
            "is_polarized": False,
            "is_seed": True,
            "prize": None,
            "campaign_id": None,
            "event_id": None,
            "created_at": created_at,
        }
        await db.posts.insert_one(doc)
        created_count += 1
        print(f"  ✅ [{i+1:02d}/50] '{seed_post['word']}'")

    print(f"\n🎉 {created_count} posts seed criados. Total @besord: {existing + created_count}")

if __name__ == "__main__":
    asyncio.run(seed())
