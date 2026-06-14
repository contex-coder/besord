import sys
import asyncio

from fastapi import FastAPI, APIRouter, HTTPException, Header, Query, Request
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import json
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
import httpx
import random
import stripe
from datetime import datetime, timezone, timedelta

from geo import get_client_ip, geo_lookup
from pricing import TIERS, get_tier, tiers_public
from email_alerts import send_milestone_email, crossed_milestones
from moderation import check_word as moderate_word
from themes import THEMES, THEME_KEYS
from bw_pricing import BW_TIERS_DEFAULTS, BW_TIER_KEYS
from dataclasses import replace as dataclass_replace
import password_auth as _pwd_auth
import workspaces as _ws_mod
from routes import discovery as _discovery_mod

# Snapshot of the *original* tier definitions imported from pricing.py.
# Used by the admin "reset" endpoint to restore defaults — never mutated.
_ORIGINAL_TIERS = {k: dataclass_replace(v) for k, v in TIERS.items()}

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
# Corrige SSL handshake com MongoDB Atlas — adiciona tlsAllowInvalidCertificates se não presente
if "mongodb.net" in mongo_url and "tlsAllowInvalidCertificates" not in mongo_url:
    separator = "&" if "?" in mongo_url else "?"
    # Só adiciona retryWrites/w se ainda não estão no URL
    extra = "tlsAllowInvalidCertificates=true"
    if "retryWrites" not in mongo_url:
        extra += "&retryWrites=true"
    if "w=majority" not in mongo_url:
        extra += "&w=majority"
    mongo_url = f"{mongo_url}{separator}{extra}"
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

stripe.api_key = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

# Suporta tanto FRONTEND_URL (backend/.env.production) quanto FRONTEND_BASE_URL (render.yaml)
FRONTEND_URL = os.environ.get("FRONTEND_URL") or os.environ.get("FRONTEND_BASE_URL", "http://localhost:3000")
# Suporta tanto BACKEND_URL (backend/.env.production) quanto APP_BASE_URL (render.yaml)
BACKEND_URL = os.environ.get("BACKEND_URL") or os.environ.get("APP_BASE_URL", "http://localhost:8000")

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "").lower()
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")

# This must match the authorized redirect URI in your Google Cloud console
# IMPORTANTE: Use uma variável de ambiente GOOGLE_REDIRECT_URI se quiser algo fixo
# Senão, usa BACKEND_URL (que deve ser a URL exata do backend, sem barra no final)
backend_url_clean = BACKEND_URL.rstrip('/')
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI") or f'{backend_url_clean}/api/auth/google/callback'

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Rota raiz para teste de conectividade
@app.get("/")
async def root():
    return {"app": "Besord API", "status": "running", "version": "1.0.0"}

# CORREÇÃO: SessionMiddleware com https_only=True em produção
# Em ambiente de desenvolvimento (localhost), usamos False
is_production = "vercel.app" in FRONTEND_URL or "render.com" in BACKEND_URL
app.add_middleware(
    SessionMiddleware, 
    secret_key=os.environ.get("SESSION_SECRET", "uma-chave-secreta-muito-segura-e-longa-para-sessao-besord"),
    session_cookie="besord_session",
    same_site="lax",  # Importante para redirecionamentos OAuth entre domínios
    https_only=is_production  # True em produção (Render/Vercel), False em localhost
)

# CORS Configuration - Allow frontend domain
# IMPORTANTE: allow_credentials=True NÃO pode ser usado com allow_origins=["*"]
CORS_ORIGINS = [
    FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:8081",
    "http://localhost:5173",
]
# Remove potencial "*" que causaria erro CORS
CORS_ORIGINS = [o for o in CORS_ORIGINS if o != "*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Inicializar índices MongoDB no startup
@app.on_event("startup")
async def startup():
    try:
        # TTL index para eventos expirados (auto-delete após 7 dias)
        await db.events.create_index("expires_at", expireAfterSeconds=0)
        # Índice para geolocalização de eventos
        await db.events.create_index([("location.lat", 1), ("location.lon", 1)])
        await db.events.create_index("status")
        # Índice para push tokens
        await db.push_tokens.create_index("user_id")
        # Índices para admiradores
        await db.admirers.create_index("user_id")
        await db.admirers.create_index("admired_user_id")
        await db.admirers.create_index(
            [("user_id", 1), ("admired_user_id", 1)], unique=True
        )
        # Índices para sincronia_logs
        await db.sincronia_logs.create_index([("pair_id", 1), ("date", 1)], unique=True)
        await db.sincronia_logs.create_index("user_id_a")
        await db.sincronia_logs.create_index("user_id_b")
    except Exception:
        pass  # Índices já existem

# ProxyHeaders não está disponível nesta versão do Starlette.
# O Render já lida com os cabeçalhos X-Forwarded corretamente.
# Middleware personalizado não é necessário.

# ---------- Models ----------
class SessionRequest(BaseModel):
    session_id: str

class AppleSignInRequest(BaseModel):
    identity_token: str
    user_identifier: str
    email: Optional[str] = None
    full_name: Optional[str] = None

class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    has_business: bool = False
    is_admin: bool = False
    age_confirmed: bool = False
    birth_year: Optional[int] = None
    bw_balance: int = 0
    bw_total_earned: int = 0
    admirers_count: int = 0

class AuthResponse(BaseModel):
    token: str
    user: UserOut

class PostCreate(BaseModel):
    word: str
    image_base64: str  # primeira imagem (principal)
    images_base64: Optional[List[str]] = None  # carrossel (até 3 imagens adicionais)
    video_base64: Optional[str] = None  # vídeo de até 30s
    is_hype: bool = False  # se True, entra nos Hypes
    theme: Optional[str] = None  # one of THEME_KEYS, optional

class CommentOut(BaseModel):
    comment_id: str
    post_id: str
    user_id: str
    user_name: str
    user_picture: Optional[str] = None
    word: str
    created_at: str

class PostOut(BaseModel):
    post_id: str
    word: str
    image_base64: str
    images_base64: Optional[List[str]] = None  # carrossel (até 3)
    video_base64: Optional[str] = None  # vídeo 30s
    is_hype: bool = False
    is_sponsored: bool = False
    is_polarized: bool = False
    author_id: str
    author_name: str
    author_picture: Optional[str] = None
    created_at: str
    aprovo_count: int
    desaprovo_count: int
    comments_count: int
    user_vote: Optional[Literal["aprovo", "desaprovo"]] = None
    user_comment: Optional[str] = None
    top_comments: List[CommentOut] = []
    campaign_id: Optional[str] = None

class VoteRequest(BaseModel):
    vote: Literal["aprovo", "desaprovo"]

class CommentCreate(BaseModel):
    word: str

class ReportCreate(BaseModel):
    reason: Optional[str] = None

class BusinessProfileCreate(BaseModel):
    company_name: str
    country: str
    country_code: str
    tax_id: Optional[str] = None
    contact_email: str
    contact_name: str

class CampaignCreate(BaseModel):
    word: str
    image_base64: str
    tier_key: str  # local|regional|national|global
    target_country_code: Optional[str] = None
    target_region: Optional[str] = None
    target_city: Optional[str] = None
    promo_code: Optional[str] = None
    theme: Optional[str] = None  # one of THEME_KEYS, optional
    workspace_id: Optional[str] = None  # if not provided, uses the user's first business workspace

class CampaignOut(BaseModel):
    campaign_id: str
    post_id: Optional[str] = None
    word: str
    image_base64: str
    tier_key: str
    tier_name: str
    scope: str
    duration_days: int
    target_country_code: Optional[str] = None
    target_region: Optional[str] = None
    target_city: Optional[str] = None
    workspace_id: Optional[str] = None
    theme: Optional[str] = None
    status: str  # pending_payment, active, completed, canceled
    amount_cents: int
    included_votes: int
    votes_collected: int
    aprovo_count: int
    desaprovo_count: int
    created_at: str
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    checkout_url: Optional[str] = None


# ---------- Analytics ----------
async def _posthog_send(event: str, distinct_id: str, properties: dict) -> None:
    api_key = os.getenv("POSTHOG_API_KEY")
    if not api_key:
        return
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            await client.post(
                "https://us.i.posthog.com/capture/",
                json={"api_key": api_key, "event": event,
                      "distinct_id": distinct_id, "properties": properties},
            )
    except Exception:
        pass

def track_event(event: str, distinct_id: str, properties: dict = {}) -> None:
    try:
        asyncio.create_task(_posthog_send(event, distinct_id, properties))
    except RuntimeError:
        pass

# ---------- Groq / Sincronia ----------
async def _groq_insight(agreement_rate: int, posts_in_common: int) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or posts_in_common == 0:
        return ""
    prompt = (
        f"Em 1 frase curta e poética (máximo 12 palavras em português), descreve "
        f"uma sincronia de {agreement_rate}% de concordância em {posts_in_common} "
        f"posts entre dois admiradores mútuos. Sem aspas, sem explicações."
    )
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 40,
                    "temperature": 0.8,
                },
            )
            data = r.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception:
        return ""

async def calculate_sincronia(user_id: str, date: str) -> None:
    """Calculates convergence between mutual admirers after session complete."""
    # Find users that current user admires
    admiring_cursor = db.admirers.find({"user_id": user_id}, {"_id": 0, "admired_user_id": 1})
    admiring_docs = await admiring_cursor.to_list(length=200)
    admiring_ids = {d["admired_user_id"] for d in admiring_docs}
    if not admiring_ids:
        return

    # Find mutual admirers (they also admire back)
    mutual_cursor = db.admirers.find(
        {"user_id": {"$in": list(admiring_ids)}, "admired_user_id": user_id},
        {"_id": 0, "user_id": 1},
    )
    mutual_docs = await mutual_cursor.to_list(length=200)
    mutual_ids = [d["user_id"] for d in mutual_docs]
    if not mutual_ids:
        return

    # Get current user's votes today
    votes_a = await db.votes.find(
        {"user_id": user_id, "created_at": {"$gte": datetime.fromisoformat(date)}},
        {"_id": 0, "post_id": 1, "vote": 1},
    ).to_list(length=20)
    votes_a_map = {v["post_id"]: v["vote"] for v in votes_a}

    for other_id in mutual_ids:
        pair_id = "__".join(sorted([user_id, other_id]))
        # Skip if already calculated today
        existing = await db.sincronia_logs.find_one({"pair_id": pair_id, "date": date})
        if existing:
            continue

        # Check if other user completed session today
        other_user = await db.users.find_one({"user_id": other_id}, {"_id": 0, "daily_interactions": 1})
        if not other_user:
            continue
        di = other_user.get("daily_interactions") or {}
        if di.get("reset_date") != date or int(di.get("count", 0)) < 10:
            continue  # Other user hasn't completed session yet

        # Get other user's votes today
        votes_b = await db.votes.find(
            {"user_id": other_id, "created_at": {"$gte": datetime.fromisoformat(date)}},
            {"_id": 0, "post_id": 1, "vote": 1},
        ).to_list(length=20)
        votes_b_map = {v["post_id"]: v["vote"] for v in votes_b}

        # Find common posts and calculate agreement
        common_posts = set(votes_a_map.keys()) & set(votes_b_map.keys())
        posts_in_common = len(common_posts)
        if posts_in_common == 0:
            continue

        agreements = sum(1 for pid in common_posts if votes_a_map[pid] == votes_b_map[pid])
        agreement_rate = round(agreements / posts_in_common * 100)

        insight = await _groq_insight(agreement_rate, posts_in_common)

        await db.sincronia_logs.update_one(
            {"pair_id": pair_id, "date": date},
            {"$set": {
                "pair_id": pair_id,
                "user_id_a": min(user_id, other_id),
                "user_id_b": max(user_id, other_id),
                "date": date,
                "agreement_rate": agreement_rate,
                "posts_in_common": posts_in_common,
                "agreements": agreements,
                "insight_text": insight,
                "created_at": datetime.now(timezone.utc),
            }},
            upsert=True,
        )

# ---------- Helpers ----------
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Não autenticado")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Sessão inválida")
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Sessão expirada")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return user


async def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    try:
        return await get_current_user(authorization)
    except HTTPException:
        return None


def user_out(user: dict) -> UserOut:
    # Normalize for safe comparison (Google may return mixed case)
    user_email = (user.get("email") or "").strip().lower()
    is_admin = bool(ADMIN_EMAIL and user_email == ADMIN_EMAIL)
    return UserOut(
        user_id=user["user_id"],
        email=user["email"],
        name=user["name"],
        picture=user.get("picture"),
        has_business=bool(user.get("business_profile")) or False,  # workspace check below
        is_admin=is_admin,
        age_confirmed=bool(user.get("age_confirmed_at")),
        birth_year=user.get("birth_year"),
        bw_balance=int(user.get("bw_balance", 0) or 0),
        bw_total_earned=int(user.get("bw_total_earned", 0) or 0),
        admirers_count=int(user.get("admirers_count", 0) or 0),
    )


WORD_RE = re.compile(r"^[A-Za-zÀ-ÿ0-9]{1,20}$")


def normalize_word(w: str) -> str:
    return (w or "").strip().upper()


def comment_doc_to_out(c: dict) -> CommentOut:
    return CommentOut(
        comment_id=c["comment_id"],
        post_id=c["post_id"],
        user_id=c["user_id"],
        user_name=c.get("user_name", ""),
        user_picture=c.get("user_picture"),
        word=c["word"],
        created_at=c["created_at"].isoformat() if isinstance(c["created_at"], datetime) else str(c["created_at"]),
    )


async def serialize_post(doc: dict, current_user_id: Optional[str]) -> PostOut:
    user_vote = None
    user_comment = None
    if current_user_id:
        v = await db.votes.find_one({"post_id": doc["post_id"], "user_id": current_user_id}, {"_id": 0, "vote": 1})
        if v:
            user_vote = v["vote"]
        c = await db.comments.find_one({"post_id": doc["post_id"], "user_id": current_user_id}, {"_id": 0, "word": 1})
        if c:
            user_comment = c["word"]

    cursor = db.comments.find({"post_id": doc["post_id"]}, {"_id": 0}).sort("created_at", -1).limit(3)
    top_comments_docs = await cursor.to_list(length=3)

    # Suporta posts antigos/seed com campo 'media' (URLs) em vez de 'image_base64'
    img = doc.get("image_base64") or ""
    if not img:
        media = doc.get("media", [])
        if media and isinstance(media, list) and isinstance(media[0], dict):
            img = media[0].get("url", "")

    return PostOut(
        post_id=doc["post_id"],
        word=doc["word"],
        image_base64=img,
        images_base64=doc.get("images_base64"),  # carrossel
        video_base64=doc.get("video_base64"),    # vídeo 30s
        is_hype=bool(doc.get("is_hype")),
        author_id=doc["author_id"],
        author_name=doc.get("author_name", ""),
        author_picture=doc.get("author_picture"),
        created_at=doc["created_at"].isoformat() if isinstance(doc["created_at"], datetime) else str(doc["created_at"]),
        aprovo_count=int(doc.get("aprovo_count", 0)),
        desaprovo_count=int(doc.get("desaprovo_count", 0)),
        comments_count=int(doc.get("comments_count", 0)),
        user_vote=user_vote,
        user_comment=user_comment,
        top_comments=[comment_doc_to_out(c) for c in top_comments_docs],
        is_sponsored=bool(doc.get("is_sponsored")),
        is_polarized=bool(doc.get("is_polarized")),
        campaign_id=doc.get("campaign_id"),
    )


def serialize_campaign(c: dict, checkout_url: Optional[str] = None) -> CampaignOut:
    tier = TIERS.get(c["tier_key"]) if c.get("tier_key") in TIERS else None
    return CampaignOut(
        campaign_id=c["campaign_id"],
        post_id=c.get("post_id"),
        word=c["word"],
        image_base64=c["image_base64"],
        tier_key=c["tier_key"],
        tier_name=tier.name if tier else c["tier_key"].upper(),
        scope=c["scope"],
        duration_days=c["duration_days"],
        target_country_code=c.get("target_country_code"),
        target_region=c.get("target_region"),
        target_city=c.get("target_city"),
        theme=c.get("theme"),
        workspace_id=c.get("workspace_id"),
        status=c["status"],
        amount_cents=int(c["amount_cents"]),
        included_votes=int(c["included_votes"]),
        votes_collected=int(c.get("votes_collected", 0)),
        aprovo_count=int(c.get("aprovo_count", 0)),
        desaprovo_count=int(c.get("desaprovo_count", 0)),
        created_at=c["created_at"].isoformat() if isinstance(c["created_at"], datetime) else str(c["created_at"]),
        starts_at=c["starts_at"].isoformat() if c.get("starts_at") and isinstance(c["starts_at"], datetime) else None,
        ends_at=c["ends_at"].isoformat() if c.get("ends_at") and isinstance(c["ends_at"], datetime) else None,
        checkout_url=checkout_url or c.get("checkout_url"),
    )


# ---------- Notify helper ----------
async def notify_user(user_id: str, title: str, body: str, notif_type: str = "info", data: dict = None):
    """Insert a notification into the DB. Fire-and-forget — never raises."""
    try:
        await db.notifications.insert_one({
            "user_id": user_id,
            "type": notif_type,
            "title": title,
            "body": body,
            "read": False,
            "data": data or {},
            "created_at": datetime.now(timezone.utc),
        })
    except Exception as exc:
        print(f"[notify_user] failed for {user_id}: {exc}")


# ---------- Auth Routes ----------

@api_router.get("/health")
async def health_check():
    return {"status": "ok", "app": "besord-backend", "version": "1.0.0"}


@api_router.get("/auth/google/login")
async def auth_google_login(request: Request):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google Client ID not configured")

    # Generate a random state value to prevent CSRF
    state = uuid.uuid4().hex
    # Store the state in the user's session for later validation
    request.session['oauth_state'] = state

    google_auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={GOOGLE_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=openid%20email%20profile"
        f"&access_type=offline"
        f"&prompt=select_account"
        f"&state={state}"
    )
    return RedirectResponse(url=google_auth_url)


@api_router.get("/auth/google/callback")
async def auth_google_callback(request: Request, code: str, state: str, error: Optional[str] = None):
    if error:
        raise HTTPException(status_code=400, detail=f"Google login error: {error}")

    # Validate the state to prevent CSRF
    if state != request.session.get('oauth_state'):
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    async with httpx.AsyncClient() as http:
        try:
            token_response = await http.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
            )
            token_response.raise_for_status()
            token_data = token_response.json()

            user_info_response = await http.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {token_data['access_token']}"},
            )
            user_info_response.raise_for_status()
            user_info = user_info_response.json()

        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Failed to communicate with Google: {e.response.text}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

    email = (user_info.get("email") or "").strip().lower()
    name = user_info.get("name", email)
    picture = user_info.get("picture")

    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by Google")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {"user_id": user_id, "email": email, "name": name, "picture": picture,
                "provider": "google", "created_at": datetime.now(timezone.utc)}
        await db.users.insert_one(user.copy())
    else:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"name": name, "picture": picture}})
        user["name"] = name
        user["picture"] = picture

    session_token = f"google_{uuid.uuid4().hex}"
    await db.user_sessions.delete_many({"user_id": user["user_id"]}) # Invalidate old sessions
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user["user_id"],
        "email_snapshot": email,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    
    # Redirect to frontend with the token
    redirect_url = f'{FRONTEND_URL}/auth/callback?token={session_token}'
    return RedirectResponse(url=redirect_url)


@api_router.post("/auth/apple", response_model=AuthResponse)
async def auth_apple(payload: AppleSignInRequest):
    if not payload.user_identifier:
        raise HTTPException(status_code=400, detail="user_identifier obrigatório")
    apple_id = payload.user_identifier
    user = await db.users.find_one({"apple_id": apple_id}, {"_id": 0})
    if not user:
        if payload.email:
            user = await db.users.find_one({"email": payload.email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": payload.email or f"{apple_id[:16]}@privaterelay.appleid.com",
            "name": payload.full_name or "Apple User",
            "picture": None,
            "apple_id": apple_id,
            "provider": "apple",
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(user.copy())
    else:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"apple_id": apple_id, "provider": "apple"}})

    session_token = f"apple_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user["user_id"],
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    return AuthResponse(token=session_token, user=user_out(user))


@api_router.get("/auth/me", response_model=UserOut)
async def auth_me(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    # Dynamic has_business: check if there's an active business workspace
    biz_ws = await db.workspaces.find_one(
        {"owner_user_id": user["user_id"], "type": "business", "deleted_at": {"$exists": False}},
    )
    has_biz = bool(biz_ws)
    out = user_out(user)
    out.has_business = has_biz
    return out


class AgeConfirmRequest(BaseModel):
    birth_year: int


MIN_AGE_YEARS = 13


@api_router.post("/auth/confirm-age", response_model=UserOut)
async def auth_confirm_age(payload: AgeConfirmRequest,
                            authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    current_year = datetime.now(timezone.utc).year
    if payload.birth_year < 1900 or payload.birth_year > current_year:
        raise HTTPException(status_code=400, detail="Ano de nascimento inválido.")
    age = current_year - payload.birth_year
    if age < MIN_AGE_YEARS:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {
                "age_blocked_at": datetime.now(timezone.utc),
                "birth_year": payload.birth_year,
            }},
        )
        await db.user_sessions.delete_many({"user_id": user["user_id"]})
        raise HTTPException(
            status_code=403,
            detail=f"Idade mínima exigida: {MIN_AGE_YEARS} anos.",
        )
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "birth_year": payload.birth_year,
            "age_confirmed_at": datetime.now(timezone.utc),
        }},
    )
    user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return user_out(user)


@api_router.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


@api_router.get("/geo/me")
async def geo_me(request: Request, authorization: Optional[str] = Header(None)):
    """Return the detected country and city for the current user based on IP."""
    user = await get_optional_user(authorization)
    client_ip = get_client_ip(request.headers)
    geo = await geo_lookup(client_ip) if client_ip else {"country": None, "country_code": None, "city": None, "region": None}
    return {
        "ip": client_ip,
        "country": geo.get("country"),
        "country_code": geo.get("country_code"),  # ISO 3166-1 alpha-2
        "city": geo.get("city"),
        "region": geo.get("region"),
    }


@api_router.get("/auth/whoami")
async def whoami(authorization: Optional[str] = Header(None)):
    user = await get_optional_user(authorization)
    if not user:
        return {"authenticated": False, "admin_email_configured": bool(ADMIN_EMAIL)}
    user_email = (user.get("email") or "").strip().lower()
    return {
        "authenticated": True,
        "email": user["email"],
        "name": user["name"],
        "user_id": user["user_id"],
        "is_admin": bool(ADMIN_EMAIL and user_email == ADMIN_EMAIL),
        "admin_email_configured": ADMIN_EMAIL or None,
        "matches_admin": bool(ADMIN_EMAIL and user_email == ADMIN_EMAIL),
    }

# ==============================
# ADMIRADORES
# ==============================

@api_router.post("/users/{target_user_id}/admire")
async def admire_user(target_user_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    my_id = user["user_id"]
    if my_id == target_user_id:
        raise HTTPException(status_code=400, detail="Não podes admirar-te a ti próprio.")
    target = await db.users.find_one({"user_id": target_user_id}, {"_id": 0, "name": 1})
    if not target:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado.")
    existing = await db.admirers.find_one({"user_id": my_id, "admired_user_id": target_user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Já estás a admirar este utilizador.")
    await db.admirers.insert_one({
        "user_id": my_id,
        "admired_user_id": target_user_id,
        "followed_at": datetime.now(timezone.utc),
    })
    await db.users.update_one({"user_id": target_user_id}, {"$inc": {"admirers_count": 1}})
    await notify_user(
        target_user_id,
        "Tens um novo admirador!",
        f"{user.get('name', 'Alguém')} passou a admirar-te.",
        notif_type="new_admirer",
        data={"from_user_id": my_id, "from_user_name": user.get("name", "")},
    )
    return {"ok": True, "admiring": True}


@api_router.delete("/users/{target_user_id}/admire")
async def unadmire_user(target_user_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    my_id = user["user_id"]
    result = await db.admirers.delete_one({"user_id": my_id, "admired_user_id": target_user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Não estavas a admirar este utilizador.")
    await db.users.update_one(
        {"user_id": target_user_id, "admirers_count": {"$gt": 0}},
        {"$inc": {"admirers_count": -1}},
    )
    return {"ok": True, "admiring": False}


@api_router.get("/users/{target_user_id}/profile")
async def get_public_profile(target_user_id: str, authorization: Optional[str] = Header(None)):
    current_user = await get_optional_user(authorization)
    target = await db.users.find_one({"user_id": target_user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado.")
    is_admired = False
    if current_user:
        is_admired = bool(await db.admirers.find_one({
            "user_id": current_user["user_id"],
            "admired_user_id": target_user_id,
        }))
    cursor = db.posts.find(
        {"author_id": target_user_id, "hidden": {"$ne": True}},
        {"_id": 0}
    ).sort("created_at", -1).limit(20)
    posts = await cursor.to_list(length=20)
    serialized = []
    for p in posts:
        serialized.append(await serialize_post(p, current_user["user_id"] if current_user else None))
    return {
        "user_id": target["user_id"],
        "name": target.get("name", ""),
        "picture": target.get("picture"),
        "bio": target.get("bio", ""),
        "location": target.get("location", ""),
        "admirers_count": int(target.get("admirers_count", 0)),
        "bw_total_earned": int(target.get("bw_total_earned", 0)),
        "is_admired": is_admired,
        "posts": serialized,
    }


@api_router.get("/users/me/admiring")
async def my_admiring(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    cursor = db.admirers.find({"user_id": user["user_id"]}, {"_id": 0, "admired_user_id": 1})
    docs = await cursor.to_list(length=1000)
    return {"admiring": [d["admired_user_id"] for d in docs]}


@api_router.get("/users/me/veredito")
async def get_veredito(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    uid = user["user_id"]
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # Post publicado hoje pelo utilizador
    user_post = await db.posts.find_one(
        {"author_id": uid, "created_at": {"$gte": today_start}},
        {"_id": 0, "word": 1, "post_id": 1, "aprovo_count": 1, "desaprovo_count": 1},
    )

    # Votos lançados hoje pelo utilizador
    votes_cursor = db.votes.find(
        {"user_id": uid, "created_at": {"$gte": today_start}},
        {"_id": 0, "post_id": 1, "vote": 1},
    )
    votes_today = await votes_cursor.to_list(length=10)

    # Tema dominante dos posts votados
    dominant_theme = None
    if votes_today:
        voted_ids = [v["post_id"] for v in votes_today]
        voted_posts = await db.posts.find(
            {"post_id": {"$in": voted_ids}},
            {"_id": 0, "theme": 1},
        ).to_list(length=10)
        themes = [p["theme"] for p in voted_posts if p.get("theme")]
        if themes:
            dominant_theme = max(set(themes), key=themes.count)

    aprovo_count = sum(1 for v in votes_today if v["vote"] == "aprovo")
    total = int(user.get("daily_interactions", {}).get("count", len(votes_today)))

    approval_rate = None
    if user_post:
        total_votes = user_post["aprovo_count"] + user_post["desaprovo_count"]
        if total_votes > 0:
            approval_rate = round(user_post["aprovo_count"] / total_votes * 100)

    return {
        "word": user_post["word"] if user_post else None,
        "post_id": user_post["post_id"] if user_post else None,
        "approval_rate": approval_rate,
        "aprovo_votes_cast": aprovo_count,
        "total_votes_cast": total,
        "dominant_theme": dominant_theme,
        "date": datetime.now(timezone.utc).strftime("%d %b %Y").upper(),
    }


@api_router.get("/users/me/sincronia")
async def get_sincronia(authorization: Optional[str] = Header(None)):
    """Returns today's sincronia records for the current user."""
    user = await get_current_user(authorization)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    uid = user["user_id"]
    cursor = db.sincronia_logs.find(
        {"date": today, "$or": [{"user_id_a": uid}, {"user_id_b": uid}]},
        {"_id": 0},
    )
    docs = await cursor.to_list(length=50)
    results = []
    for doc in docs:
        other_id = doc["user_id_b"] if doc["user_id_a"] == uid else doc["user_id_a"]
        other = await db.users.find_one({"user_id": other_id}, {"_id": 0, "name": 1, "user_id": 1})
        results.append({
            "other_user_id": other_id,
            "other_name": other.get("name", "?") if other else "?",
            "agreement_rate": doc["agreement_rate"],
            "posts_in_common": doc["posts_in_common"],
            "agreements": doc.get("agreements", 0),
            "insight_text": doc.get("insight_text", ""),
            "date": doc["date"],
        })
    return results


@api_router.get("/feed/admired")
async def feed_admired(
    skip: int = 0,
    limit: int = Query(default=20, le=50),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(authorization)
    cursor = db.admirers.find({"user_id": user["user_id"]}, {"_id": 0, "admired_user_id": 1})
    admiring_docs = await cursor.to_list(length=1000)
    admiring_ids = [d["admired_user_id"] for d in admiring_docs]
    if not admiring_ids:
        return []
    cursor = db.posts.find(
        {"author_id": {"$in": admiring_ids}, "hidden": {"$ne": True}},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit)
    posts = await cursor.to_list(length=limit)
    return [await serialize_post(p, user["user_id"]) for p in posts]


# ==============================
# POSTS ROUTES
# ==============================

# ---------- LIST THEMES ----------
@api_router.get("/themes")
async def list_themes():
    """Return all available themes."""
    return THEMES

# ---------- LIST POSTS ----------
@api_router.get("/posts")
async def list_posts(
    sort: Literal["recent", "trending"] = Query("recent"),
    source: Optional[str] = Query(None),
    theme: Optional[str] = Query(None),
    scope: Literal["world", "country", "city"] = Query("world"),
    country_code: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    is_hype: Optional[bool] = Query(None),  # filtrar por hype
    authorization: Optional[str] = Header(None),
):
    user = await get_optional_user(authorization)
    current_user_id = user["user_id"] if user else None

    # Base match — never show hidden posts
    match: dict = {"hidden": {"$ne": True}}

    # Hype filter — only posts with is_hype=True
    if is_hype:
        match["is_hype"] = True

    # Source filter: followed styles
    if source == "styles":
        if not current_user_id:
            return []
        followed = await db.followed_styles.find(
            {"user_id": current_user_id}, {"_id": 0, "word": 1}
        ).to_list(length=500)
        words = [r["word"] for r in followed]
        if not words:
            return []
        match["word"] = {"$in": words}

    # Theme filter
    if theme and theme in THEME_KEYS:
        match["theme"] = theme

    # Scope filter (geo-based) — uses geo data from votes to determine where posts are trending
    # We join with votes to find posts that have votes from the given scope
    if scope == "country" and country_code:
        # Find post_ids that have votes from this country
        vote_posts = await db.votes.distinct("post_id", {"geo.country_code": country_code.upper()})
        if vote_posts:
            match["post_id"] = {"$in": vote_posts}
        else:
            # Fallback: show all if no geo data yet
            pass
    elif scope == "city" and city:
        vote_posts = await db.votes.distinct("post_id", {"geo.city": city})
        if vote_posts:
            match["post_id"] = {"$in": vote_posts}

    # Include posts from events where user checked in AND voted (feed misto)
    if current_user_id:
        events_checkin = await db.events.find(
            {"checkins": current_user_id},
            {"_id": 0, "event_id": 1}
        ).to_list(length=50)
        event_ids = [e["event_id"] for e in events_checkin]
        if event_ids:
            # Only show event posts that the user has also voted on
            voted_post_ids = await db.votes.distinct("post_id", {"user_id": current_user_id})
            # Add event posts to the match query
            existing_post_ids = match.get("post_id", {})
            if isinstance(existing_post_ids, dict) and "$in" in existing_post_ids:
                # Combine scope filter + event posts (with vote requirement)
                match["$or"] = [
                    {"post_id": {"$in": existing_post_ids["$in"]}},
                    {"event_id": {"$in": event_ids}, "post_id": {"$in": voted_post_ids}},
                ]
                del match["post_id"]
            else:
                # Show normal posts + event posts where user voted
                match["$or"] = [
                    {"event_id": {"$exists": False}},
                    {"event_id": {"$in": event_ids}, "post_id": {"$in": voted_post_ids}},
                ]

    # Sort
    if sort == "trending":
        sort_order = [("aprovo_count", -1), ("created_at", -1)]
    else:
        sort_order = [("created_at", -1)]

    cursor = db.posts.find(match, {"_id": 0}).sort(sort_order)
    docs = await cursor.to_list(length=200)

    results = []
    for doc in docs:
        results.append(await serialize_post(doc, current_user_id))

    return results


# ---------- CREATE POST ----------
@api_router.post("/posts")
async def create_post(payload: PostCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)

    # Validate age confirmed
    if not user.get("age_confirmed_at"):
        raise HTTPException(status_code=403, detail="Precisas de confirmar a idade primeiro.")

    word = normalize_word(payload.word)
    if not WORD_RE.match(word):
        raise HTTPException(status_code=400, detail="Palavra inválida. Apenas letras e números, 1 a 20 caracteres.")

    ok, reason = moderate_word(word)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)

    image = payload.image_base64
    if not image or len(image) < 50:
        raise HTTPException(status_code=400, detail="Imagem inválida ou demasiado pequena.")

    post_id = f"post_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    doc = {
        "post_id": post_id,
        "word": word,
        "image_base64": image,
        "images_base64": (payload.images_base64 or [])[:3],  # até 3 imagens extra
        "video_base64": payload.video_base64,
        "is_hype": bool(payload.is_hype),
        "author_id": user["user_id"],
        "author_name": user.get("name", ""),
        "author_picture": user.get("picture"),
        "created_at": now,
        "aprovo_count": 0,
        "desaprovo_count": 0,
        "comments_count": 0,
        "is_sponsored": False,
        "is_polarized": False,
        "theme": payload.theme if payload.theme in THEME_KEYS else None,
        "hidden": False,
    }
    await db.posts.insert_one(doc)
    return await serialize_post(doc, user["user_id"])


# ---------- GET SINGLE POST ----------
@api_router.get("/posts/{post_id}")
async def get_post(post_id: str, authorization: Optional[str] = Header(None)):
    user = await get_optional_user(authorization)
    doc = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Post não encontrado.")
    return await serialize_post(doc, user["user_id"] if user else None)


# ---------- DELETE POST ----------
@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    doc = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Post não encontrado.")
    if doc["author_id"] != user["user_id"] and not user_out(user).is_admin:
        raise HTTPException(status_code=403, detail="Não podes eliminar um post de outro utilizador.")
    await db.posts.delete_one({"post_id": post_id})
    await db.votes.delete_many({"post_id": post_id})
    await db.comments.delete_many({"post_id": post_id})
    return {"ok": True}


# ---------- VOTE ----------
@api_router.post("/posts/{post_id}/vote")
async def vote_post(post_id: str, payload: VoteRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    doc = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Post não encontrado.")
    if doc.get("hidden"):
        raise HTTPException(status_code=404, detail="Post não encontrado.")

    existing = await db.votes.find_one({"post_id": post_id, "user_id": user["user_id"]}, {"_id": 0})
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")  # UTC date

    # ── Time-Gate: only for new votes on non-sponsored posts ──────────────────
    is_new_vote = not existing
    is_sponsored_post = bool(doc.get("is_sponsored")) or bool(doc.get("campaign_id"))
    if is_new_vote and not is_sponsored_post:
        di = user.get("daily_interactions") or {}
        if di.get("reset_date") != today_str:
            # New day — reset counter in DB
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {"$set": {"daily_interactions": {"count": 0, "reset_date": today_str}}},
            )
            di = {"count": 0, "reset_date": today_str}
        count = int(di.get("count", 0))
        if count >= 10:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "time_gate_reached",
                    "message": "O mundo já te deu o suficiente por hoje. Vá viver.",
                    "remaining": 0,
                },
            )
    # ─────────────────────────────────────────────────────────────────────────

    if existing:
        if existing["vote"] == payload.vote:
            # Toggle off — does NOT count as a new interaction
            await db.votes.delete_one({"post_id": post_id, "user_id": user["user_id"]})
            field = "aprovo_count" if payload.vote == "aprovo" else "desaprovo_count"
            await db.posts.update_one({"post_id": post_id}, {"$inc": {field: -1}})
        else:
            # Switch vote — already counted when first voted, no new interaction
            await db.votes.update_one(
                {"post_id": post_id, "user_id": user["user_id"]},
                {"$set": {"vote": payload.vote, "created_at": now}},
            )
            old_field = "aprovo_count" if existing["vote"] == "aprovo" else "desaprovo_count"
            new_field = "aprovo_count" if payload.vote == "aprovo" else "desaprovo_count"
            await db.posts.update_one({"post_id": post_id}, {"$inc": {old_field: -1, new_field: 1}})
            # Award BW for the new vote
            await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"bw_balance": 1, "bw_total_earned": 1}})
    else:
        # New vote — increment daily interaction counter
        await db.votes.insert_one({
            "post_id": post_id,
            "user_id": user["user_id"],
            "vote": payload.vote,
            "created_at": now,
            "geo": {"country_code": None, "city": None},
        })
        field = "aprovo_count" if payload.vote == "aprovo" else "desaprovo_count"
        await db.posts.update_one({"post_id": post_id}, {"$inc": {field: 1}})
        # Award BW
        await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"bw_balance": 1, "bw_total_earned": 1}})
        # Increment Time-Gate counter (only for non-sponsored posts)
        if not is_sponsored_post:
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {"$inc": {"daily_interactions.count": 1},
                 "$set": {"daily_interactions.reset_date": today_str}},
            )

    doc = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    post_out = await serialize_post(doc, user["user_id"])
    # Attach remaining interactions so frontend can show the warning
    fresh_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "daily_interactions": 1})
    di = (fresh_user or {}).get("daily_interactions") or {}
    today_str2 = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    count_today = int(di.get("count", 0)) if di.get("reset_date") == today_str2 else 0
    remaining = max(0, 10 - count_today)
    track_event("vote_cast", user["user_id"], {
        "vote": payload.vote, "post_id": post_id,
        "daily_remaining": remaining, "is_sponsored": is_sponsored_post,
    })
    if remaining == 0:
        track_event("session_complete", user["user_id"], {"date": today_str2})
        try:
            asyncio.create_task(calculate_sincronia(user["user_id"], today_str2))
        except RuntimeError:
            pass
    return {**post_out.model_dump(), "daily_interactions_remaining": remaining}


# ---------- COMMENT ----------
@api_router.post("/posts/{post_id}/comment")
async def create_comment(post_id: str, payload: CommentCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    doc = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Post não encontrado.")

    word = normalize_word(payload.word)
    if not WORD_RE.match(word):
        raise HTTPException(status_code=400, detail="Palavra inválida.")

    ok, reason = moderate_word(word)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)

    comment_id = f"cmt_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    await db.comments.insert_one({
        "comment_id": comment_id,
        "post_id": post_id,
        "user_id": user["user_id"],
        "user_name": user.get("name", ""),
        "user_picture": user.get("picture"),
        "word": word,
        "created_at": now,
    })
    await db.posts.update_one({"post_id": post_id}, {"$inc": {"comments_count": 1}})
    doc = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    return await serialize_post(doc, user["user_id"])


# ---------- DELETE COMMENT ----------
@api_router.delete("/posts/{post_id}/comment")
async def delete_comment(post_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    comment = await db.comments.find_one({"post_id": post_id, "user_id": user["user_id"]}, {"_id": 0})
    if not comment:
        raise HTTPException(status_code=404, detail="Comentário não encontrado.")
    await db.comments.delete_one({"post_id": post_id, "user_id": user["user_id"]})
    await db.posts.update_one({"post_id": post_id}, {"$inc": {"comments_count": -1}})
    doc = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    return await serialize_post(doc, user["user_id"])


# ---------- REPORT ----------
@api_router.post("/posts/{post_id}/report")
async def report_post(post_id: str, payload: ReportCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    doc = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Post não encontrado.")

    report_id = f"rpt_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    await db.reports.insert_one({
        "report_id": report_id,
        "post_id": post_id,
        "user_id": user["user_id"],
        "reason": payload.reason or "No reason",
        "created_at": now,
    })

    # Count reports — hide after 3
    report_count = await db.reports.count_documents({"post_id": post_id})
    hidden = False
    if report_count >= 3:
        await db.posts.update_one({"post_id": post_id}, {"$set": {"hidden": True}})
        hidden = True

    return {"ok": True, "hidden": hidden}


# ==============================
# BUSINESS & CAMPAIGN ROUTES
# ==============================

# ---------- CREATE BUSINESS PROFILE ----------
@api_router.post("/business/profile")
async def create_business_profile(payload: BusinessProfileCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if user.get("business_profile"):
        raise HTTPException(status_code=400, detail="Já tens um perfil de empresa.")
    profile = {
        "company_name": payload.company_name,
        "country": payload.country,
        "country_code": payload.country_code.upper(),
        "tax_id": payload.tax_id,
        "contact_email": payload.contact_email,
        "contact_name": payload.contact_name,
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"business_profile": profile}})
    return {"ok": True, "profile": profile}


# ---------- GET BUSINESS PROFILE ----------
@api_router.get("/business/profile")
async def get_business_profile(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    profile = user.get("business_profile")
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil de empresa não encontrado.")
    return {"profile": profile}


# ---------- UPDATE BUSINESS PROFILE ----------
@api_router.put("/business/profile")
async def update_business_profile(payload: BusinessProfileCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user.get("business_profile"):
        raise HTTPException(status_code=404, detail="Perfil de empresa não encontrado.")
    profile = {
        "company_name": payload.company_name,
        "country": payload.country,
        "country_code": payload.country_code.upper(),
        "tax_id": payload.tax_id,
        "contact_email": payload.contact_email,
        "contact_name": payload.contact_name,
        "updated_at": datetime.now(timezone.utc),
    }
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"business_profile": profile}})
    return {"ok": True, "profile": profile}


# ---------- LIST CAMPAIGNS ----------
@api_router.get("/campaigns")
async def list_campaigns(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    cursor = db.campaigns.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1)
    docs = await cursor.to_list(length=100)
    return [serialize_campaign(c) for c in docs]


# ---------- GET SINGLE CAMPAIGN ----------
@api_router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    doc = await db.campaigns.find_one({"campaign_id": campaign_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Campanha não encontrada.")
    return serialize_campaign(doc)


# ---------- CREATE CAMPAIGN ----------
@api_router.post("/campaigns")
async def create_campaign(payload: CampaignCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    # Verifica se o utilizador tem um workspace business (não apagado) em vez do legacy business_profile
    biz_ws = await db.workspaces.find_one(
        {"owner_user_id": user["user_id"], "type": "business", "deleted_at": {"$exists": False}},
    )
    if not biz_ws:
        raise HTTPException(status_code=403, detail="Precisas de criar uma empresa primeiro em /workspaces.")
    if not biz_ws.get("verified"):
        raise HTTPException(status_code=403, detail="A empresa precisa de ter o email verificado. Verifica a tua caixa de entrada.")

    word = normalize_word(payload.word)
    if not WORD_RE.match(word):
        raise HTTPException(status_code=400, detail="Palavra inválida.")

    ok, reason = moderate_word(word)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)

    image = payload.image_base64
    if not image or len(image) < 50:
        raise HTTPException(status_code=400, detail="Imagem inválida.")

    if payload.tier_key not in TIERS:
        raise HTTPException(status_code=400, detail="Tier inválido.")

    tier = TIERS[payload.tier_key]

    # Validate geo requirements based on tier scope
    if tier.scope == "national" and not payload.target_country_code:
        raise HTTPException(status_code=400, detail="Campanha nacional precisa de um país alvo.")
    if tier.scope == "regional" and not payload.target_region:
        raise HTTPException(status_code=400, detail="Campanha regional precisa de uma região alvo.")
    if tier.scope == "local" and not payload.target_city:
        raise HTTPException(status_code=400, detail="Campanha local precisa de uma cidade alvo.")

    campaign_id = f"camp_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    # Create the post first
    post_id = f"post_{uuid.uuid4().hex[:12]}"
    post_doc = {
        "post_id": post_id,
        "word": word,
        "image_base64": image,
        "author_id": user["user_id"],
        "author_name": user.get("name", ""),
        "author_picture": user.get("picture"),
        "created_at": now,
        "aprovo_count": 0,
        "desaprovo_count": 0,
        "comments_count": 0,
        "is_sponsored": True,
        "campaign_id": campaign_id,
        "theme": payload.theme if payload.theme in THEME_KEYS else None,
        "hidden": False,
    }
    await db.posts.insert_one(post_doc)

    # Create Stripe checkout session
    try:
        checkout = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "product_data": {
                        "name": f"Campanha {tier.name} — '{word}'",
                        "description": f"{tier.description} | {tier.scope} | {tier.duration_days} dias",
                    },
                    "unit_amount": tier.price_cents,
                },
                "quantity": 1,
            }],
            mode="payment",
            automatic_tax={"enabled": True},
            customer_creation="always",
            success_url=f"{FRONTEND_URL}/business/campaign/{campaign_id}?success=1",
            cancel_url=f"{FRONTEND_URL}/business/campaign/{campaign_id}?canceled=1",
            metadata={"campaign_id": campaign_id, "user_id": user["user_id"]},
        )
        checkout_url = checkout.url
    except Exception as e:
        # If Stripe fails, still create but without checkout URL
        checkout_url = None

    # Handle promo code discount
    amount_cents = tier.price_cents
    promo_code = payload.promo_code
    if promo_code:
        promo = await db.promo_codes.find_one({"code": promo_code.upper(), "active": True})
        if promo:
            discount_pct = promo.get("discount_pct", 0)
            amount_cents = int(amount_cents * (100 - discount_pct) / 100)

    campaign_doc = {
        "campaign_id": campaign_id,
        "post_id": post_id,
        "user_id": user["user_id"],
        "word": word,
        "image_base64": image,
        "tier_key": payload.tier_key,
        "scope": tier.scope,
        "duration_days": tier.duration_days,
        "target_country_code": payload.target_country_code.upper() if payload.target_country_code else None,
        "target_region": payload.target_region,
        "target_city": payload.target_city,
        "workspace_id": payload.workspace_id,
        "theme": payload.theme if payload.theme in THEME_KEYS else None,
        "status": "pending_payment",
        "amount_cents": amount_cents,
        "included_votes": tier.included_votes,
        "votes_collected": 0,
        "aprovo_count": 0,
        "desaprovo_count": 0,
        "created_at": now,
        "checkout_url": checkout_url,
    }
    await db.campaigns.insert_one(campaign_doc)

    return serialize_campaign(campaign_doc, checkout_url=checkout_url)


# ---------- CANCEL CAMPAIGN ----------
@api_router.post("/campaigns/{campaign_id}/cancel")
async def cancel_campaign(campaign_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    doc = await db.campaigns.find_one({"campaign_id": campaign_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Campanha não encontrada.")
    if doc["status"] not in ("pending_payment", "active"):
        raise HTTPException(status_code=400, detail="Campanha não pode ser cancelada.")
    await db.campaigns.update_one({"campaign_id": campaign_id}, {"$set": {"status": "canceled"}})
    return {"ok": True}


# ==============================
# STRIPE WEBHOOK
# ==============================
@api_router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    try:
        payload_body = await request.body()
        sig_header = request.headers.get("stripe-signature")

        if STRIPE_WEBHOOK_SECRET:
            try:
                event = stripe.Webhook.construct_event(payload_body, sig_header, STRIPE_WEBHOOK_SECRET)
            except stripe.error.SignatureVerificationError:
                raise HTTPException(status_code=400, detail="Invalid signature")
        else:
            data = json.loads(payload_body)
            event = {"type": data.get("type", ""), "data": data.get("data", {})}

        if event["type"] != "checkout.session.completed":
            return {"ok": True}

        session = event["data"]["object"]
        metadata = session.get("metadata", {})
        event_type = metadata.get("type")

        # --- Campaign payment ---
        if event_type == "campaign":
            campaign_id = metadata.get("campaign_id")
            if campaign_id:
                now = datetime.now(timezone.utc)
                await db.campaigns.update_one(
                    {"campaign_id": campaign_id},
                    {"$set": {
                        "status": "active",
                        "payment_intent": session.get("payment_intent"),
                        "paid_at": now,
                        "starts_at": now,
                        "ends_at": now + timedelta(days=30),
                    }}
                )
                campaign = await db.campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
                if campaign:
                    tier = TIERS.get(campaign.get("tier_key"))
                    if tier:
                        await db.campaigns.update_one(
                            {"campaign_id": campaign_id},
                            {"$set": {"ends_at": now + timedelta(days=tier.duration_days)}}
                        )
        # --- Event payment ---
        elif event_type == "event":
            event_id = metadata.get("event_id")
            if event_id:
                now = datetime.now(timezone.utc)
                expires_at = now + timedelta(days=7)
                await db.events.update_one(
                    {"event_id": event_id},
                    {"$set": {
                        "status": "active",
                        "paid_at": now,
                        "expires_at": expires_at,
                        "stripe_session_id": session.get("id"),
                        "payment_intent": session.get("payment_intent"),
                    }}
                )
                # Notificar empresa que o evento está no ar
                evt = await db.events.find_one({"event_id": event_id}, {"_id": 0})
                if evt:
                    await notify_user(
                        evt["company_id"],
                        f"Evento {evt['title']} está no ar!",
                        f"O teu evento está visível no feed por 7 dias. Boa sorte!",
                    )

        # --- Event exhibitor (empresa paga para postar no evento) ---
        elif event_type == "event_exhibitor":
            event_id = metadata.get("event_id")
            post_id = metadata.get("post_id")
            exhibitor_id = metadata.get("exhibitor_id")
            if event_id and post_id:
                now = datetime.now(timezone.utc)
                # Ativar post
                await db.posts.update_one(
                    {"post_id": post_id},
                    {"$set": {
                        "status": "active",
                        "paid_at": now,
                    }}
                )
                # Atualizar status do expositor no evento
                await db.events.update_one(
                    {"event_id": event_id, "exhibitors.exhibitor_id": exhibitor_id},
                    {"$set": {
                        "exhibitors.$.status": "active",
                        "exhibitors.$.paid_at": now,
                    }}
                )
                # Notificar organizador
                org_event = await db.events.find_one({"event_id": event_id}, {"_id": 0, "company_id": 1, "title": 1})
                if org_event:
                    await notify_user(
                        org_event["company_id"],
                        f"Nova empresa no evento {org_event['title']}!",
                        f"Uma empresa acabou de publicar um anúncio no teu evento.",
                    )

        # --- Save invoice (all types) ---
        if session.get("payment_intent"):
            amount_total = session.get("amount_total", 0) or session.get("amount_subtotal", 0)
            invoice_doc = {
                "invoice_id": secrets.token_hex(16),
                "stripe_session_id": session.get("id"),
                "payment_intent": session.get("payment_intent"),
                "amount_cents": amount_total,
                "currency": session.get("currency", "eur"),
                "customer_email": session.get("customer_details", {}).get("email", ""),
                "customer_name": session.get("customer_details", {}).get("name", ""),
                "metadata": metadata,
                "taxes": session.get("total_details", {}).get("breakdown", {}).get("taxes", []),
                "status": "paid",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.invoices.insert_one(invoice_doc)

        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[stripe_webhook] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
# ==============================
# NOTIFICATIONS
# ==============================
@api_router.get("/notifications")
async def list_notifications(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    cursor = db.notifications.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(50)
    docs = await cursor.to_list(length=50)
    for d in docs:
        if isinstance(d.get("created_at"), datetime):
            d["created_at"] = d["created_at"].isoformat()
    return docs


@api_router.get("/notifications/unread-count")
async def unread_count(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    count = await db.notifications.count_documents({"user_id": user["user_id"], "read": {"$ne": True}})
    return {"unread_count": count}


@api_router.post("/notifications/read-all")
async def mark_all_read(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    await db.notifications.update_many(
        {"user_id": user["user_id"], "read": {"$ne": True}},
        {"$set": {"read": True}}
    )
    return {"ok": True}


# ==============================
# BW (BEST WORD) PERSONAL AD
# ==============================
@api_router.post("/bw/personal-ad")
async def create_bw_personal_ad(payload: dict, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    post_id = payload.get("post_id")
    if not post_id:
        raise HTTPException(status_code=400, detail="post_id é obrigatório.")

    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado.")
    if post["author_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Só podes promover os teus próprios posts.")

    bw_cost = 100
    bw_balance = int(user.get("bw_balance", 0) or 0)
    if bw_balance < bw_cost:
        raise HTTPException(status_code=400, detail=f"Precisas de {bw_cost} BW (tens {bw_balance}).")

    await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"bw_balance": -bw_cost}})
    # Mark post as sponsored for 24h
    await db.posts.update_one({"post_id": post_id}, {"$set": {"is_sponsored": True, "sponsored_until": datetime.now(timezone.utc) + timedelta(hours=24)}})

    # Record transaction
    await db.bw_transactions.insert_one({
        "user_id": user["user_id"],
        "type": "spend",
        "amount": bw_cost,
        "description": f"Personal ad boost — {post['word']}",
        "created_at": datetime.now(timezone.utc),
    })

    return {"ok": True, "post_id": post_id, "bw_spent": bw_cost, "bw_remaining": bw_balance - bw_cost}


# ==============================
# ADMIN ROUTES
# ==============================
@api_router.get("/admin/users")
async def admin_list_users(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user_out(user).is_admin:
        raise HTTPException(status_code=403, detail="Apenas administradores.")
    cursor = db.users.find({}, {"_id": 0}).sort("created_at", -1).limit(100)
    users = await cursor.to_list(length=100)
    return [user_out(u) for u in users]


@api_router.get("/admin/tiers")
async def admin_get_tiers(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user_out(user).is_admin:
        raise HTTPException(status_code=403, detail="Apenas administradores.")
    return tiers_public()


@api_router.put("/admin/tiers")
async def admin_update_tiers(payload: dict, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user_out(user).is_admin:
        raise HTTPException(status_code=403, detail="Apenas administradores.")
    # Update tiers in database
    for key, values in payload.items():
        if key in TIERS:
            tier = TIERS[key]
            if "price_cents" in values:
                tier.price_cents = int(values["price_cents"])
            if "included_votes" in values:
                tier.included_votes = int(values["included_votes"])
            if "name" in values:
                tier.name = values["name"]
    return tiers_public()


@api_router.post("/admin/tiers/reset")
async def admin_reset_tiers(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user_out(user).is_admin:
        raise HTTPException(status_code=403, detail="Apenas administradores.")
    global TIERS
    TIERS.clear()
    TIERS.update({k: dataclass_replace(v) for k, v in _ORIGINAL_TIERS.items()})
    return tiers_public()


@api_router.get("/admin/campaigns")
async def admin_list_campaigns(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user_out(user).is_admin:
        raise HTTPException(status_code=403, detail="Apenas administradores.")
    cursor = db.campaigns.find({}, {"_id": 0}).sort("created_at", -1).limit(100)
    docs = await cursor.to_list(length=100)
    return [serialize_campaign(c) for c in docs]


@api_router.put("/admin/posts/{post_id}/polarize")
async def admin_toggle_polarized(post_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user_out(user).is_admin:
        raise HTTPException(status_code=403, detail="Apenas administradores.")
    doc = await db.posts.find_one({"post_id": post_id}, {"_id": 0, "is_polarized": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Post não encontrado.")
    new_value = not bool(doc.get("is_polarized"))
    await db.posts.update_one({"post_id": post_id}, {"$set": {"is_polarized": new_value}})
    return {"post_id": post_id, "is_polarized": new_value}


# ==============================
# WORKS AND PASSWORD AUTH ROUTES
# ==============================
# These are handled by mounted sub-routers in password_auth.py and workspaces.py

# ==============================

# ==============================
# EVENTOS PRESENCIAIS (FASE 2)
# ==============================

class EventCreate(BaseModel):
    title: str
    description: str
    image_base64: str
    lat: Optional[float] = None
    lon: Optional[float] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country_code: Optional[str] = None
    date: str  # ISO datetime string
    prize: Optional[str] = None
    max_participants: Optional[int] = None
    bw_reward: int = 50
    event_type: Literal["private", "public"] = "private"
    radius_km: float = 1.0


class EventOut(BaseModel):
    event_id: str
    company_id: str
    company_name: str
    title: str
    description: str
    image_base64: str
    location: dict
    date: str
    prize: Optional[str] = None
    prize_image: Optional[str] = None
    max_participants: Optional[int] = None
    participants_count: int
    bw_reward: int
    created_at: str
    expires_at: str
    status: str  # active | full | expired | raffle_done
    raffle_done: bool = False
    raffle_winner_id: Optional[str] = None
    is_participant: bool = False
    is_owner: bool = False
    event_type: str = "private"
    radius_km: float = 1.0
    checkins_count: int = 0
    exhibitors_count: int = 0
    distance_km: Optional[float] = None


class PushTokenRequest(BaseModel):
    token: str


class ExhibitorJoinRequest(BaseModel):
    invite_code: str
    word: str
    image_base64: str
    prize: Optional[str] = None
    prize_image_base64: Optional[str] = None
    is_owner_post: bool = False  # Se True, o dono do evento está a publicar


class PostReportOut(BaseModel):
    post_id: str
    word: str
    event_id: Optional[str] = None
    event_title: Optional[str] = None
    total_votes: int
    aprovo_count: int
    desaprovo_count: int
    total_comments: int
    top_comment_words: List[dict] = []
    by_country: List[dict] = []
    by_city: List[dict] = []
    by_age_group: List[dict] = []
    total_checkins_event: int = 0
    total_exhibitors_event: int = 0
    prize: Optional[str] = None
    prize_image: Optional[str] = None
    prize_drawn: bool = False
    created_at: str

@api_router.get("/events/nearby")
async def get_events_nearby(
    lat: float = Query(...),
    lon: float = Query(...),
    radius_km: float = Query(1.0, description="Raio em km para busca"),
    authorization: Optional[str] = Header(None),
):
    """Retorna eventos ativos num raio da localização do user."""
    user = await get_optional_user(authorization)
    current_user_id = user["user_id"] if user else None

    now = datetime.now(timezone.utc)
    eventos = await db.events.find({
        "status": "active",
        "expires_at": {"$gt": now},
    }, {"_id": 0}).to_list(length=100)

    nearby = []
    for event in eventos:
        loc = event.get("location", {})
        e_lat = loc.get("lat")
        e_lon = loc.get("lon")
        if e_lat is None or e_lon is None:
            continue

        from math import radians, sin, cos, sqrt, atan2

        def haversine(lat1, lon1, lat2, lon2):
            R = 6371  # km
            dlat = radians(lat2 - lat1)
            dlon = radians(lon2 - lon1)
            a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            return R * c

        dist = haversine(lat, lon, e_lat, e_lon)
        event_radius = event.get("radius_km", 1.0)
        if dist <= event_radius:
            event["distance_km"] = round(dist, 2)
            nearby.append(serialize_event(event, current_user_id))

    return sorted(nearby, key=lambda e: e.distance_km if e.distance_km else 0)


# ---------- CHECK-IN (manual) ----------
@api_router.post("/events/{event_id}/join")
async def join_event(event_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)

    # Verificar idade confirmada
    if not user.get("age_confirmed_at"):
        raise HTTPException(status_code=403, detail="Precisas de confirmar a idade primeiro.")

    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")

    if event["status"] not in ("active", "full"):
        raise HTTPException(status_code=400, detail="Evento não está ativo.")

    if event["company_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="Não podes participar no teu próprio evento.")

    participants = event.get("participants", [])
    if user["user_id"] in participants:
        raise HTTPException(status_code=400, detail="Já participas neste evento.")

    # Adicionar participante
    await db.events.update_one(
        {"event_id": event_id},
        {"$push": {"participants": user["user_id"]}}
    )

    # Creditar BW de recompensa
    bw_reward = event.get("bw_reward", 50)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {"bw_balance": bw_reward, "bw_total_earned": bw_reward}}
    )

    # Verificar se atingiu max_participants → sorteio automático
    max_p = event.get("max_participants")
    if max_p and len(participants) + 1 >= max_p:
        await db.events.update_one(
            {"event_id": event_id},
            {"$set": {"status": "full"}}
        )
        # Sorteio automático se houver prémio
        if event.get("prize"):
            all_participants = participants + [user["user_id"]]
            winner_id = random.choice(all_participants)
            await db.events.update_one(
                {"event_id": event_id},
                {"$set": {
                    "raffle_done": True,
                    "raffle_at": datetime.now(timezone.utc),
                    "raffle_winner_id": winner_id,
                    "status": "raffle_done",
                }}
            )
            # Notificar vencedor
            await notify_user(
                winner_id,
                f"🎉 Ganhaste o sorteio do evento {event['title']}!",
                f"Parabéns! O prémio \"{event['prize']}\" é teu! Entra em contacto com a empresa.",
            )
            # Notificar empresa
            await notify_user(
                event["company_id"],
                f"🎉 Sorteio automático realizado!",
                f"O vencedor do evento \"{event['title']}\" foi sorteado automaticamente.",
            )

    # Notificar empresa que alguém entrou
    await notify_user(
        event["company_id"],
        f"👥 Novo participante no evento \"{event['title']}\"!",
        f"{user.get('name', 'Alguém')} entrou no teu evento. ({len(participants) + 1}/{max_p or '∞'})",
    )

    return serialize_event(
        await db.events.find_one({"event_id": event_id}, {"_id": 0}),
        user["user_id"]
    )


# ---------- RAFFLE (Sorteio manual pelo dono) ----------
@api_router.post("/events/{event_id}/join-as-exhibitor")
async def join_as_exhibitor(event_id: str, payload: ExhibitorJoinRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)

    # Requer perfil de empresa
    if not user.get("business_profile"):
        raise HTTPException(status_code=403, detail="Precisas de criar um perfil de empresa primeiro.")

    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    if event.get("status") not in ("active", "full"):
        raise HTTPException(status_code=400, detail="Evento não está ativo.")
    if event.get("event_type") != "public":
        raise HTTPException(status_code=400, detail="Apenas eventos públicos aceitam múltiplas empresas.")

    # Validar código de convite (apenas se não for o dono)
    is_owner = event.get("company_id") == user["user_id"]
    if is_owner:
        # Dono publica sem código, mas paga igual
        pass
    elif event.get("invite_code") != payload.invite_code:
        raise HTTPException(status_code=403, detail="Código de convite inválido.")

    # Validar word
    word = normalize_word(payload.word)
    if not WORD_RE.match(word):
        raise HTTPException(status_code=400, detail="Palavra inválida. Apenas letras e números, 1 a 20 caracteres.")
    ok, reason = moderate_word(word)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)

    # Validar imagem
    if not payload.image_base64 or len(payload.image_base64) < 50:
        raise HTTPException(status_code=400, detail="Imagem inválida.")

    # Verificar limite de empresas
    exhibitors = event.get("exhibitors", [])
    if len(exhibitors) >= 100:
        raise HTTPException(status_code=400, detail="Evento atingiu o limite máximo de empresas expositoras.")

    # Verificar se já é expositor
    for ex in exhibitors:
        if ex.get("user_id") == user["user_id"]:
            raise HTTPException(status_code=400, detail="Já és expositor neste evento.")

    # Criar o post do anúncio
    post_id = f"post_{uuid.uuid4().hex[:12]}"
    exhibitor_id = f"exh_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    # Stripe Checkout Session (€9,99)
    try:
        checkout = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "product_data": {
                        "name": f"Anúncio no evento: {event['title']}",
                        "description": f"1 palavra + 1 imagem — {word}",
                    },
                    "unit_amount": await get_event_post_price(),
                },
                "quantity": 1,
            }],
            mode="payment",
            automatic_tax={"enabled": True},
            customer_creation="always",
            client_reference_id=user["user_id"],
            metadata={
                "type": "event_exhibitor",
                "event_id": event_id,
                "post_id": post_id,
                "exhibitor_id": exhibitor_id,
                "word": word,
            },
            success_url=f"{FRONTEND_URL}/evento/{event_id}?anuncio=sucesso",
            cancel_url=f"{FRONTEND_URL}/evento/{event_id}/participar?codigo={payload.invite_code}&cancelado=1",
        )

        # Guardar post como pending_payment
        post_doc = {
            "post_id": post_id,
            "word": word,
            "image_base64": payload.image_base64,
            "author_id": user["user_id"],
            "author_name": user.get("business_profile", {}).get("company_name", user.get("name", "")),
            "author_picture": user.get("picture"),
            "created_at": now,
            "aprovo_count": 0,
            "desaprovo_count": 0,
            "comments_count": 0,
            "is_sponsored": True,
            "is_event_post": True,
            "event_id": event_id,
            "exhibitor_id": exhibitor_id,
            "exhibitor_name": user.get("business_profile", {}).get("company_name", user.get("name", "")),
            "prize": (payload.prize or "").strip() or None,
            "prize_image_base64": payload.prize_image_base64,
            "prize_drawn": False,
            "hidden": False,
            "status": "pending_payment",
            "stripe_session_id": checkout.id,
        }
        await db.posts.insert_one(post_doc)

        # Registar expositor no evento
        await db.events.update_one(
            {"event_id": event_id},
            {"$push": {"exhibitors": {
                "exhibitor_id": exhibitor_id,
                "user_id": user["user_id"],
                "post_id": post_id,
                "word": word,
                "company_name": user.get("business_profile", {}).get("company_name", user.get("name", "")),
                "status": "pending_payment",
            }}}
        )

        return {
            "ok": True,
            "checkout_url": checkout.url,
            "post_id": post_id,
        }

    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao processar pagamento: {str(e)}")


# ---------- POST REPORT (relatório do anúncio no evento) ----------




@api_router.post("/events/{event_id}/raffle")
async def raffle_event(event_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)

    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    if event["company_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Só o dono do evento pode sortear.")
    if event.get("raffle_done"):
        raise HTTPException(status_code=409, detail="Sorteio já foi realizado.")

    participants = event.get("participants", [])
    if len(participants) < 1:
        raise HTTPException(status_code=400, detail="Precisa de pelo menos 1 participante para sortear.")
    if not event.get("prize"):
        raise HTTPException(status_code=400, detail="Evento não tem prémio configurado.")

    winner_id = random.choice(participants)

    await db.events.update_one(
        {"event_id": event_id},
        {"$set": {
            "raffle_done": True,
            "raffle_at": datetime.now(timezone.utc),
            "raffle_winner_id": winner_id,
            "status": "raffle_done",
        }}
    )

    # Notificar vencedor
    await notify_user(
        winner_id,
        f"🎉 Ganhaste o sorteio do evento {event['title']}!",
        f"Parabéns! O prémio \"{event['prize']}\" é teu! Entra em contacto com a empresa organizadora.",
    )

    # Notificar empresa
    winner_user = await db.users.find_one({"user_id": winner_id}, {"_id": 0, "name": 1})
    winner_name = winner_user.get("name", "Participante") if winner_user else "Participante"
    await notify_user(
        event["company_id"],
        f"🎉 Sorteio realizado!",
        f"O vencedor foi {winner_name}! Notifica-o para combinar a entrega do prémio.",
    )

    return {"ok": True, "winner_id": winner_id, "winner_name": winner_name}


# ---------- NOTIFICATIONS PUSH: REGISTAR DEVICE ----------
@api_router.post("/events/{event_id}/checkin")
async def checkin_event(event_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)

    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    if event["status"] not in ("active", "full"):
        raise HTTPException(status_code=400, detail="Evento não está ativo.")

    checkins = event.get("checkins", [])
    if user["user_id"] in checkins:
        return {"ok": True, "already_checked_in": True}

    await db.events.update_one(
        {"event_id": event_id},
        {"$push": {"checkins": user["user_id"]}}
    )

    # Notificar organizador
    await notify_user(
        event["company_id"],
        f"👤 Novo check-in no evento \"{event['title']}\"!",
        f"{user.get('name', 'Alguém')} fez check-in. Total: {len(checkins) + 1}",
    )

    return {"ok": True, "already_checked_in": False}


# ---------- APPROVE EVENT (admin) ----------
@api_router.post("/events/{event_id}/approve")
async def approve_event(event_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user_out(user).is_admin:
        raise HTTPException(status_code=403, detail="Apenas administradores podem aprovar eventos.")

    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    if event.get("event_type") != "public":
        raise HTTPException(status_code=400, detail="Apenas eventos públicos precisam de aprovação.")
    if event.get("status") != "pending_approval":
        raise HTTPException(status_code=400, detail=f"Evento está em estado \"{event.get('status')}\", não pode ser aprovado.")

    await db.events.update_one(
        {"event_id": event_id},
        {"$set": {"status": "active", "approved_at": datetime.now(timezone.utc), "approved_by": user["user_id"]}}
    )

    await notify_user(
        event["company_id"],
        f"✅ Evento \"{event['title']}\" aprovado!",
        "O teu evento público foi aprovado. Já podes convidar empresas para participar! 🚀",
    )

    return {"ok": True}


# ---------- INVITE (gerar link de convite) ----------
@api_router.post("/events/{event_id}/invite")
async def invite_exhibitor(event_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)

    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    if event["company_id"] != user["user_id"] and not user_out(user).is_admin:
        raise HTTPException(status_code=403, detail="Só o organizador pode convidar.")

    # Gerar ou retornar código de convite existente
    invite_code = event.get("invite_code")
    if not invite_code:
        import hashlib
        invite_code = hashlib.sha256(f"{event_id}:{uuid.uuid4().hex}".encode()).hex()[:12]
        await db.events.update_one(
            {"event_id": event_id},
            {"$set": {"invite_code": invite_code}}
        )

    invite_url = f"{FRONTEND_URL}/evento/{event_id}/participar?codigo={invite_code}"
    return {"invite_code": invite_code, "invite_url": invite_url}


# ---------- JOIN AS EXHIBITOR (empresa aceita convite e paga) ----------

@api_router.post("/notifications/register-device")
async def register_device(payload: PushTokenRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    await db.push_tokens.update_one(
        {"user_id": user["user_id"], "token": payload.token},
        {"$set": {"updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"ok": True}


# ==============================

# ---------- NEARBY EVENTS ----------
@api_router.get("/posts/{post_id}/report")
async def get_post_report(post_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)

    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado.")
    if post["author_id"] != user["user_id"] and not user_out(user).is_admin:
        raise HTTPException(status_code=403, detail="Só o autor do post pode ver o relatório.")

    # Votos com geo
    votes_cursor = db.votes.find({"post_id": post_id}, {"_id": 0, "vote": 1, "geo": 1, "user_id": 1})
    votes = await votes_cursor.to_list(length=1000)

    aprovo_count = sum(1 for v in votes if v["vote"] == "aprovo")
    desaprovo_count = sum(1 for v in votes if v["vote"] == "desaprovo")

    # Comentários
    comments_cursor = db.comments.find({"post_id": post_id}, {"_id": 0, "word": 1})
    comments = await comments_cursor.to_list(length=1000)
    total_comments = len(comments)

    # Palavras mais usadas nos comentários
    word_counts = {}
    for c in comments:
        w = c.get("word", "").upper()
        if w:
            word_counts[w] = word_counts.get(w, 0) + 1
    top_words = sorted(word_counts.items(), key=lambda x: -x[1])[:10]
    top_comment_words = [{"word": w, "count": c} for w, c in top_words]

    # Breakdown por país
    country_counts = {}
    for v in votes:
        cc = v.get("geo", {}).get("country_code")
        if cc:
            country_counts[cc] = country_counts.get(cc, 0) + 1
    by_country = [{"label": k, "value": v} for k, v in sorted(country_counts.items(), key=lambda x: -x[1])]

    # Breakdown por cidade
    city_counts = {}
    for v in votes:
        c = v.get("geo", {}).get("city")
        if c:
            city_counts[c] = city_counts.get(c, 0) + 1
    by_city = [{"label": k, "value": v} for k, v in sorted(city_counts.items(), key=lambda x: -x[1])]

    # Breakdown por idade (dos users que votaram)
    age_groups = {"13-17": 0, "18-24": 0, "25-34": 0, "35-44": 0, "45+": 0}
    for v in votes:
        voter = await db.users.find_one({"user_id": v.get("user_id", "")}, {"_id": 0, "birth_year": 1})
        if voter and voter.get("birth_year"):
            age = datetime.now(timezone.utc).year - voter["birth_year"]
            if age < 18: age_groups["13-17"] += 1
            elif age < 25: age_groups["18-24"] += 1
            elif age < 35: age_groups["25-34"] += 1
            elif age < 45: age_groups["35-44"] += 1
            else: age_groups["45+"] += 1
    by_age_group = [{"label": k, "value": v} for k, v in age_groups.items() if v > 0]

    # Dados do evento (se for post de evento)
    event_info = {}
    if post.get("is_event_post") and post.get("event_id"):
        event = await db.events.find_one({"event_id": post["event_id"]}, {"_id": 0, "title": 1, "checkins": 1, "exhibitors": 1})
        if event:
            event_info = {
                "event_id": post["event_id"],
                "event_title": event.get("title"),
                "total_checkins_event": len(event.get("checkins", [])),
                "total_exhibitors_event": len(event.get("exhibitors", [])),
            }

    return PostReportOut(
        post_id=post_id,
        word=post["word"],
        event_id=post.get("event_id"),
        event_title=event_info.get("event_title"),
        total_votes=len(votes),
        aprovo_count=aprovo_count,
        desaprovo_count=desaprovo_count,
        total_comments=total_comments,
        top_comment_words=top_comment_words,
        by_country=by_country,
        by_city=by_city,
        by_age_group=by_age_group,
        total_checkins_event=event_info.get("total_checkins_event", 0),
        total_exhibitors_event=event_info.get("total_exhibitors_event", 0),
        prize=post.get("prize"),
        prize_image=post.get("prize_image_base64"),
        prize_drawn=bool(post.get("prize_drawn")),
        created_at=post["created_at"].isoformat() if isinstance(post["created_at"], datetime) else str(post["created_at"]),
    )


# ---------- DRAW PRIZE (sorteio do post) ----------
@api_router.post("/posts/{post_id}/draw-prize")
async def draw_post_prize(post_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)

    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado.")
    if post["author_id"] != user["user_id"] and not user_out(user).is_admin:
        raise HTTPException(status_code=403, detail="Só o autor do post pode sortear.")
    if not post.get("prize"):
        raise HTTPException(status_code=400, detail="Este post não tem prémio configurado.")
    if post.get("prize_drawn"):
        raise HTTPException(status_code=409, detail="Sorteio já foi realizado.")

    # Todos os votantes (APROVO + DESAPROVO) concorrem — o sorteio é secundário
    votes = await db.votes.find({"post_id": post_id}, {"_id": 0, "user_id": 1}).to_list(length=1000)
    if len(votes) < 1:
        raise HTTPException(status_code=400, detail="Ninguém votou ainda. Não há participantes no sorteio.")

    winner_id = random.choice([v["user_id"] for v in votes])

    await db.posts.update_one(
        {"post_id": post_id},
        {"$set": {"prize_drawn": True, "prize_winner_id": winner_id, "prize_drawn_at": datetime.now(timezone.utc)}}
    )

    # Notificar vencedor
    winner_user = await db.users.find_one({"user_id": winner_id}, {"_id": 0, "name": 1})
    winner_name = winner_user.get("name", "Participante") if winner_user else "Participante"
    await notify_user(
        winner_id,
        f"🎉 Ganhaste o sorteio!",
        f"Parabéns! Ganhaste \"{post['prize']}\" do post \"{post['word']}\"! Entra em contacto com o organizador.",
    )

    return {"ok": True, "winner_id": winner_id, "winner_name": winner_name}


# Preço do anúncio em evento (configurável pelo admin)
EVENT_POST_PRICE_CENTS = 999  # Default: €9,99

async def get_event_post_price() -> int:
    """Lê o preço configurado no DB ou usa default"""
    config = await db.config.find_one({"key": "event_post_price_cents"})
    if config:
        return int(config.get("value", EVENT_POST_PRICE_CENTS))
    return EVENT_POST_PRICE_CENTS


# ==============================
# BUSINESS DASHBOARD
# ==============================
@api_router.get("/business/dashboard")
async def business_dashboard(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user.get("business_profile"):
        raise HTTPException(status_code=403, detail="Precisas de criar um perfil de empresa.")
    
    uid = user["user_id"]
    now = datetime.now(timezone.utc)
    
    # Meus eventos
    meus_eventos = await db.events.find({"company_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(length=100)
    
    # Meus anúncios em eventos (como expositor)
    meus_anuncios = await db.posts.find({
        "author_id": uid,
        "is_event_post": True,
    }, {"_id": 0}).sort("created_at", -1).to_list(length=100)
    
    # Check-ins recebidos (total de todos os meus eventos)
    total_checkins = sum(e.get("checkins", []) for e in meus_eventos)
    total_checkins_count = len(total_checkins) if isinstance(total_checkins, list) else 0
    
    # Votos nos meus anúncios de evento
    post_ids = [p["post_id"] for p in meus_anuncios]
    total_aprovo = 0
    total_desaprovo = 0
    if post_ids:
        votes_cursor = db.votes.find({"post_id": {"$in": post_ids}}, {"_id": 0, "vote": 1})
        async for v in votes_cursor:
            if v["vote"] == "aprovo":
                total_aprovo += 1
            else:
                total_desaprovo += 1
    
    return {
        "eventos": [serialize_event(e, uid) for e in meus_eventos],
        "anuncios": [await serialize_post(p, uid) for p in meus_anuncios],
        "total_eventos": len(meus_eventos),
        "total_anuncios": len(meus_anuncios),
        "total_checkins_recebidos": total_checkins_count,
        "total_aprovo": total_aprovo,
        "total_desaprovo": total_desaprovo,
        "company_name": user.get("business_profile", {}).get("company_name", ""),
    }


@api_router.post("/events")
async def create_event(payload: EventCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)

    # Requer perfil de empresa
    if not user.get("business_profile"):
        raise HTTPException(status_code=403, detail="Precisas de criar um perfil de empresa primeiro.")

    # Validar imagem
    if not payload.image_base64 or len(payload.image_base64) < 50:
        raise HTTPException(status_code=400, detail="Imagem inválida.")

    # Validar título
    title = (payload.title or "").strip()
    if not title or len(title) < 3:
        raise HTTPException(status_code=400, detail="Título deve ter pelo menos 3 caracteres.")

    # Validar data
    try:
        event_date = datetime.fromisoformat(payload.date)
    except Exception:
        raise HTTPException(status_code=400, detail="Data inválida. Use formato ISO (ex: 2026-07-15T20:00:00).")

    # Processar localização
    location = {}
    if payload.lat is not None and payload.lon is not None:
        location = {"lat": payload.lat, "lon": payload.lon, "address": payload.address or "", "city": payload.city or "", "country_code": (payload.country_code or "").upper()}
    elif payload.address:
        # Tentar geocoding automático
        geo = await geocode_address(payload.address)
        if geo:
            location = {"lat": geo["lat"], "lon": geo["lon"], "address": payload.address, "city": payload.city or "", "country_code": (payload.country_code or "").upper()}
        else:
            location = {"lat": None, "lon": None, "address": payload.address, "city": payload.city or "", "country_code": (payload.country_code or "").upper()}
    else:
        raise HTTPException(status_code=400, detail="Fornece localização (lat/lon ou endereço).")

    event_id = f"event_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=7)

    # Preparar dados do evento para criar após pagamento
    event_data = {
        "event_id": event_id,
        "company_id": user["user_id"],
        "company_name": user.get("business_profile", {}).get("company_name", user.get("name", "")),
        "title": title,
        "description": (payload.description or "").strip(),
        "image_base64": payload.image_base64,
        "location": location,
        "date": event_date,
        "prize": (payload.prize or "").strip() or None,
        "max_participants": payload.max_participants,
        "bw_reward": max(1, payload.bw_reward),
        "event_type": payload.event_type,
        "radius_km": max(0.1, min(10.0, payload.radius_km)),
        "participants": [],
        "checkins": [],
        "exhibitors": [],
        "created_at": now,
        "expires_at": expires_at,
        "status": "pending_approval" if payload.event_type == "public" else "pending_payment",
    }

    # Salvar temporariamente como pending_payment
    await db.events.insert_one(event_data)

    # Criar Stripe Checkout Session (€9,99)
    try:
        checkout = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "product_data": {
                        "name": f"Evento: {title}",
                        "description": f"Criação de evento presencial — 7 dias de visibilidade no Besord",
                    },
                    "unit_amount": await get_event_post_price(),  # €9,99
                },
                "quantity": 1,
            }],
            mode="payment",
            automatic_tax={"enabled": True},
            customer_creation="always",
            client_reference_id=user["user_id"],
            metadata={
                "type": "event",
                "event_id": event_id,
            },
            success_url=f"{FRONTEND_URL}/eventos/sucesso?event_id={event_id}",
            cancel_url=f"{FRONTEND_URL}/business/eventos/novo?cancelado=1",
        )
        # Atualizar com checkout_url
        await db.events.update_one(
            {"event_id": event_id},
            {"$set": {"checkout_url": checkout.url, "stripe_session_id": checkout.id}}
        )
        return {"event_id": event_id, "checkout_url": checkout.url, "status": "pending_payment"}
    except Exception as e:
        # Se Stripe falhar, remover evento pendente
        await db.events.delete_one({"event_id": event_id})
        raise HTTPException(status_code=502, detail=f"Erro ao processar pagamento: {str(e)}")


# ---------- LIST EVENTS ----------
@api_router.get("/events")
async def list_events(
    scope: Literal["world", "country", "city"] = Query("world"),
    country_code: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    radius_km: Optional[float] = Query(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_optional_user(authorization)
    current_user_id = user["user_id"] if user else None

    now = datetime.now(timezone.utc)
    match: dict = {
        "status": {"$in": ["active", "full"]},
        "expires_at": {"$gt": now},
    }

    # Scope filter
    if scope == "country" and country_code:
        match["location.country_code"] = country_code.upper()
    elif scope == "city" and city:
        match["location.city"] = {"$regex": re.escape(city), "$options": "i"}

    cursor = db.events.find(match, {"_id": 0}).sort("created_at", -1)
    docs = await cursor.to_list(length=100)

    results = []
    for doc in docs:
        results.append(serialize_event(doc, current_user_id))

    # Se tem lat/lon, ordenar por proximidade
    if lat is not None and lon is not None:
        from math import radians, sin, cos, sqrt, atan2

        def haversine(lat1, lon1, lat2, lon2):
            R = 6371  # km
            dlat = radians(lat2 - lat1)
            dlon = radians(lon2 - lon1)
            a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            return R * c

        for r in results:
            loc = r.location
            if loc.get("lat") and loc.get("lon"):
                r.distance_km = round(haversine(lat, lon, loc["lat"], loc["lon"]), 1)
            else:
                r.distance_km = None

        # Filtrar por raio se especificado
        if radius_km:
            results = [r for r in results if r.distance_km is not None and r.distance_km <= radius_km]

        results.sort(key=lambda r: r.distance_km if r.distance_km is not None else float("inf"))

    return results


# ---------- GET SINGLE EVENT ----------
@api_router.get("/events/{event_id}")
async def get_event(event_id: str, authorization: Optional[str] = Header(None)):
    user = await get_optional_user(authorization)
    doc = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    return serialize_event(doc, user["user_id"] if user else None)


# ==============================
# USER: Events where I checked in (badge "estive lá")
# ==============================
@api_router.get("/me/events-checkin")
async def my_checkedin_events(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    cursor = db.events.find({"checkins": user["user_id"]}, {"_id": 0}).sort("date", -1)
    docs = await cursor.to_list(length=100)
    return [serialize_event(d, user["user_id"]) for d in docs]


@api_router.get("/me/event-posts-voted")
async def my_event_posts_voted(authorization: Optional[str] = Header(None)):
    """
    Devolve os posts de eventos onde o user fez check-in E votou.
    Útil para o ecrã "Meus Eventos" com os anúncios que votei.
    """
    user = await get_current_user(authorization)
    
    # Eventos onde fez check-in
    events_checkin = await db.events.find(
        {"checkins": user["user_id"]},
        {"_id": 0, "event_id": 1, "title": 1, "image_base64": 1, "date": 1}
    ).to_list(length=50)
    event_ids = [e["event_id"] for e in events_checkin]
    
    if not event_ids:
        return {"eventos": [], "posts": []}
    
    # Posts desses eventos
    event_posts = await db.posts.find(
        {"event_id": {"$in": event_ids}, "hidden": {"$ne": True}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=200)
    
    # Ver quais o user votou
    voted_post_ids = set()
    if event_posts:
        votes = await db.votes.find(
            {"user_id": user["user_id"], "post_id": {"$in": [p["post_id"] for p in event_posts]}},
            {"_id": 0, "post_id": 1}
        ).to_list(length=200)
        voted_post_ids = {v["post_id"] for v in votes}
    
    # Serializar posts com info de voto
    result_posts = []
    for p in event_posts:
        serialized = await serialize_post(p, user["user_id"])
        result_posts.append(serialized)
    
    return {
        "eventos": [serialize_event(e, user["user_id"]) for e in events_checkin],
        "posts": result_posts,
        "voted_post_ids": list(voted_post_ids),
    }


# ==============================
# ADMIN: LIST ALL EVENTS (search by city/country)
# ==============================
@api_router.get("/admin/events")
async def admin_list_events(
    country_code: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(authorization)
    if not user_out(user).is_admin:
        raise HTTPException(status_code=403, detail="Apenas administradores.")
    
    query: dict = {}
    if country_code:
        query["location.country_code"] = country_code.upper()
    if city:
        query["location.city"] = {"$regex": re.escape(city), "$options": "i"}
    if status:
        query["status"] = status
    
    cursor = db.events.find(query, {"_id": 0}).sort("created_at", -1)
    docs = await cursor.to_list(length=500)
    return [serialize_event(d, user["user_id"]) for d in docs]


# ==============================
# ADMIN: CREATE EVENT (admin can create on behalf of any company)
# ==============================
@api_router.post("/admin/events")
async def admin_create_event(payload: EventCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user_out(user).is_admin:
        raise HTTPException(status_code=403, detail="Apenas administradores.")
    
    # Same logic as create_event but without requiring business_profile
    if not payload.image_base64 or len(payload.image_base64) < 50:
        raise HTTPException(status_code=400, detail="Imagem inválida.")
    title = (payload.title or "").strip()
    if not title or len(title) < 3:
        raise HTTPException(status_code=400, detail="Título deve ter pelo menos 3 caracteres.")
    try:
        event_date = datetime.fromisoformat(payload.date)
    except Exception:
        raise HTTPException(status_code=400, detail="Data inválida.")
    
    location = {}
    if payload.lat is not None and payload.lon is not None:
        location = {"lat": payload.lat, "lon": payload.lon, "address": payload.address or "", "city": payload.city or "", "country_code": (payload.country_code or "").upper()}
    elif payload.address:
        raise HTTPException(status_code=400, detail="Admin: fornece coordenadas (lat/lon).")
    else:
        raise HTTPException(status_code=400, detail="Fornece localização.")
    
    event_id = f"event_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=7)
    
    event_data = {
        "event_id": event_id,
        "company_id": user["user_id"],
        "company_name": "Besord Admin",
        "title": title,
        "description": (payload.description or "").strip(),
        "image_base64": payload.image_base64,
        "location": location,
        "date": event_date,
        "prize": None,
        "max_participants": None,
        "bw_reward": 50,
        "event_type": "public",
        "radius_km": max(0.1, min(2.0, payload.radius_km)),
        "participants": [],
        "checkins": [],
        "exhibitors": [],
        "created_at": now,
        "expires_at": expires_at,
        "status": "active",  # Admin events are auto-approved
    }
    await db.events.insert_one(event_data)
    return serialize_event(event_data, user["user_id"])


# ==============================
# PUBLIC: SEARCH EVENTS by city/country
# ==============================
@api_router.get("/events/search")
async def search_events(
    q: str = Query(..., description="Cidade, país ou endereço"),
    authorization: Optional[str] = Header(None),
):
    user = await get_optional_user(authorization)
    current_user_id = user["user_id"] if user else None
    now = datetime.now(timezone.utc)
    
    # Search by city, country_code, or address
    query = {
        "status": {"$in": ["active", "full"]},
        "expires_at": {"$gt": now},
        "$or": [
            {"location.city": {"$regex": q, "$options": "i"}},
            {"location.country_code": {"$regex": q, "$options": "i"}},
            {"location.address": {"$regex": q, "$options": "i"}},
            {"title": {"$regex": q, "$options": "i"}},
        ]
    }
    cursor = db.events.find(query, {"_id": 0}).sort("created_at", -1)
    docs = await cursor.to_list(length=100)
    return [serialize_event(d, current_user_id) for d in docs]


# ==============================
# PUBLIC: USER CHECK-IN to event
# ==============================
@api_router.post("/events/{event_id}/checkin")
async def checkin_event(event_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    if event["status"] not in ("active", "full"):
        raise HTTPException(status_code=400, detail="Evento não está ativo.")
    
    checkins = event.get("checkins", [])
    if user["user_id"] in checkins:
        return {"ok": True, "already_checked_in": True}
    
    await db.events.update_one(
        {"event_id": event_id},
        {"$push": {"checkins": user["user_id"]}}
    )
    await notify_user(
        event["company_id"],
        f"👤 Novo check-in no evento \"{event['title']}\"!",
        f"{user.get('name', 'Alguém')} fez check-in. Total: {len(checkins) + 1}",
    )
    return {"ok": True, "already_checked_in": False}


# ==============================
# HELPERS
# ==============================
def serialize_event(doc: dict, current_user_id: Optional[str] = None) -> EventOut:
    participants = doc.get("participants", [])
    checkins = doc.get("checkins", [])
    exhibitors = doc.get("exhibitors", [])
    
    return EventOut(
        event_id=doc["event_id"],
        company_id=doc.get("company_id", ""),
        company_name=doc.get("company_name", ""),
        title=doc["title"],
        description=doc.get("description", ""),
        image_base64=doc["image_base64"],
        location=doc.get("location", {}),
        date=doc["date"].isoformat() if isinstance(doc["date"], datetime) else doc["date"],
        prize=doc.get("prize"),
        prize_image=doc.get("prize_image_base64"),
        max_participants=doc.get("max_participants"),
        participants_count=len(participants),
        bw_reward=doc.get("bw_reward", 50),
        created_at=doc["created_at"].isoformat() if isinstance(doc["created_at"], datetime) else doc["created_at"],
        expires_at=doc["expires_at"].isoformat() if isinstance(doc["expires_at"], datetime) else doc["expires_at"],
        status=doc.get("status", "active"),
        raffle_done=bool(doc.get("raffle_done")),
        raffle_winner_id=doc.get("raffle_winner_id"),
        is_participant=current_user_id in participants if current_user_id else False,
        is_owner=current_user_id == doc.get("company_id") if current_user_id else False,
        event_type=doc.get("event_type", "private"),
        radius_km=doc.get("radius_km", 1.0),
        checkins_count=len(checkins),
        exhibitors_count=len(exhibitors),
        distance_km=doc.get("distance_km"),
    )


# ==============================
# JOIN EVENT (participate with BW reward)
# ==============================
# END — EVENTOS PRESENCIAIS
# ==============================

# ==============================
# FASE 2 — EDITORIAL / WORD OF THE DAY
# ==============================

class WordOfDayCreate(BaseModel):
    image_url: str
    word: str
    theme: Optional[str] = None
    bw_bonus: int = 5

@api_router.post("/editorial/word-of-day")
async def create_word_of_day(payload: WordOfDayCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if user.get("email", "").lower() != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin only")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    doc = {
        "type": "word_of_day",
        "word": payload.word.upper().strip(),
        "image_url": payload.image_url,
        "theme": payload.theme,
        "bw_bonus": payload.bw_bonus,
        "active_date": today,
        "winning_post_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.editorial_posts.replace_one({"active_date": today, "type": "word_of_day"}, doc, upsert=True)
    return {"ok": True, "word": doc["word"], "date": today}

@api_router.get("/editorial/word-of-day/today")
async def get_word_of_day_today():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    doc = await db.editorial_posts.find_one({"active_date": today, "type": "word_of_day"}, {"_id": 0})
    if not doc:
        return {"word_of_day": None}
    return {"word_of_day": doc}


# ==============================
# FASE 2 — ESPELHO DE SESSÃO SIMPLIFICADO
# ==============================

async def _groq_session_insight(words_seen: list, approval_rate: int, dominant_theme: Optional[str]) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return ""
    words_sample = ", ".join(words_seen[:6]) if words_seen else "variadas"
    theme_note = f" O tema dominante foi {dominant_theme}." if dominant_theme else ""
    prompt = (
        f"Analisa em 1-2 frases curtas (máximo 25 palavras em português) as escolhas de alguém "
        f"que aprovou {approval_rate}% do que viu hoje, cujas palavras foram: {words_sample}.{theme_note} "
        f"Tom: analista comportamental estoico. Directo. Sem sentimentalismo. "
        f"Sem 'jornada', 'luz', 'coração', 'bem-estar'. Sem aspas. Sem explicações."
    )
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 60,
                    "temperature": 0.75,
                },
            )
            data = r.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception:
        return ""

@api_router.get("/insights/session")
async def get_session_insight(authorization: Optional[str] = Header(None)):
    """Espelho de Sessão Simplificado — usa só dados da sessão do dia, sem user_memory."""
    user = await get_current_user(authorization)
    uid = user["user_id"]
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    votes_cursor = db.votes.find(
        {"user_id": uid, "created_at": {"$gte": today_start}},
        {"_id": 0, "post_id": 1, "vote": 1},
    )
    votes_today = await votes_cursor.to_list(length=10)
    if not votes_today:
        return {"insight": None}

    voted_ids = [v["post_id"] for v in votes_today]
    voted_posts = await db.posts.find(
        {"post_id": {"$in": voted_ids}},
        {"_id": 0, "word": 1, "theme": 1},
    ).to_list(length=10)

    words_seen = [p["word"] for p in voted_posts if p.get("word")]
    themes = [p["theme"] for p in voted_posts if p.get("theme")]
    dominant_theme = max(set(themes), key=themes.count) if themes else None
    aprovo_count = sum(1 for v in votes_today if v["vote"] == "aprovo")
    approval_rate = round(aprovo_count / len(votes_today) * 100) if votes_today else 0

    insight = await _groq_session_insight(words_seen, approval_rate, dominant_theme)
    return {"insight": insight or None}


# ==============================
# FASE 2 — SISTEMA DE CONVITE FUNDADOR
# ==============================

@api_router.post("/founders/invite")
async def create_founder_invite(authorization: Optional[str] = Header(None)):
    """Admin cria código de convite para um Fundador."""
    user = await get_current_user(authorization)
    if user.get("email", "").lower() != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin only")

    total = await db.founder_invites.count_documents({})
    if total >= 100:
        raise HTTPException(status_code=400, detail="Limite de 100 Fundadores atingido")

    code = f"BESORD-{uuid.uuid4().hex[:8].upper()}"
    doc = {
        "code": code,
        "invited_by_user_id": user["user_id"],
        "used_by_user_id": None,
        "used_at": None,
        "founder_number": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.founder_invites.insert_one(doc)
    return {"code": code, "total_invites_created": total + 1}

@api_router.get("/founders/validate/{code}")
async def validate_founder_code(code: str):
    """Valida código e retorna info do convidante (sem auth — usada na página pública)."""
    invite = await db.founder_invites.find_one({"code": code.upper()}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Código inválido")
    if invite.get("used_by_user_id"):
        raise HTTPException(status_code=410, detail="Código já utilizado")

    used_count = await db.founder_invites.count_documents({"used_by_user_id": {"$ne": None}})
    inviter = await db.users.find_one(
        {"user_id": invite["invited_by_user_id"]}, {"_id": 0, "name": 1, "avatar": 1}
    )
    return {
        "valid": True,
        "invited_by_name": inviter.get("name", "Besord") if inviter else "Besord",
        "invited_by_avatar": inviter.get("avatar") if inviter else None,
        "next_founder_number": used_count + 1,
        "remaining_spots": 100 - used_count,
    }

@api_router.post("/founders/redeem/{code}")
async def redeem_founder_code(code: str, authorization: Optional[str] = Header(None)):
    """Utilizador que acabou de se registar usa o código para receber badge Fundador."""
    user = await get_current_user(authorization)
    uid = user["user_id"]

    if user.get("founder_number"):
        raise HTTPException(status_code=400, detail="Já és Fundador")

    invite = await db.founder_invites.find_one({"code": code.upper()}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Código inválido")
    if invite.get("used_by_user_id"):
        raise HTTPException(status_code=410, detail="Código já utilizado")

    used_count = await db.founder_invites.count_documents({"used_by_user_id": {"$ne": None}})
    founder_number = used_count + 1

    await db.founder_invites.update_one(
        {"code": code.upper()},
        {"$set": {"used_by_user_id": uid, "used_at": datetime.now(timezone.utc).isoformat(), "founder_number": founder_number}}
    )
    await db.users.update_one({"user_id": uid}, {"$set": {"founder_number": founder_number}})

    return {"ok": True, "founder_number": founder_number}

@api_router.get("/founders/stats")
async def get_founder_stats(authorization: Optional[str] = Header(None)):
    """Admin vê estado dos convites."""
    user = await get_current_user(authorization)
    if user.get("email", "").lower() != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin only")
    total_created = await db.founder_invites.count_documents({})
    total_used = await db.founder_invites.count_documents({"used_by_user_id": {"$ne": None}})
    return {"total_invites_created": total_created, "total_redeemed": total_used, "remaining_spots": 100 - total_used}


# ==============================
# FASE 2 — BESORD PRIMEIRO OLHAR (B2B)
# ==============================

class PrimeiroOlharCreate(BaseModel):
    name: str
    brand_name: str
    brand_intended_word: str
    image_urls: List[str]
    duration_hours: int = 48

@api_router.post("/events/primeiro-olhar")
async def create_primeiro_olhar(payload: PrimeiroOlharCreate, authorization: Optional[str] = Header(None)):
    """Admin cria evento Primeiro Olhar para uma marca."""
    user = await get_current_user(authorization)
    if user.get("email", "").lower() != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin only")
    if len(payload.image_urls) > 5:
        raise HTTPException(status_code=400, detail="Máximo 5 imagens por Primeiro Olhar")

    event_id = f"po_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    end_time = now + timedelta(hours=payload.duration_hours)

    event_doc = {
        "event_id": event_id,
        "type": "primeiro_olhar",
        "name": payload.name,
        "brand_name": payload.brand_name,
        "brand_intended_word": payload.brand_intended_word.upper().strip(),
        "image_urls": payload.image_urls,
        "status": "active",
        "date_start": now.isoformat(),
        "date_end": end_time.isoformat(),
        "created_by": user["user_id"],
        "created_at": now.isoformat(),
    }
    await db.events.insert_one(event_doc)

    # Criar posts individuais para cada imagem
    posts_created = []
    for i, img_url in enumerate(payload.image_urls):
        post_id = f"po_post_{event_id}_{i}"
        post_doc = {
            "post_id": post_id,
            "author_id": user["user_id"],
            "author_name": payload.brand_name,
            "author_picture": None,
            "word": payload.brand_intended_word.upper().strip(),
            "media": [{"type": "image", "url": img_url}],
            "vote_count": {"aprovo": 0, "desaprovo": 0},
            "aprovo_count": 0,
            "desaprovo_count": 0,
            "hype": 0,
            "theme": None,
            "is_polarized": False,
            "event_id": event_id,
            "is_primeiro_olhar": True,
            "image_index": i,
            "created_at": now.isoformat(),
        }
        await db.posts.insert_one(post_doc)
        posts_created.append(post_id)

    return {
        "ok": True,
        "event_id": event_id,
        "posts": posts_created,
        "ends_at": end_time.isoformat(),
        "share_link": f"/eventos/{event_id}",
    }

@api_router.get("/events/{event_id}/primeiro-olhar-report")
async def get_primeiro_olhar_report(event_id: str, authorization: Optional[str] = Header(None)):
    """Gera relatório de dados do Primeiro Olhar. PDF gerado via /reports.py."""
    user = await get_current_user(authorization)
    if user.get("email", "").lower() != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin only")

    event = await db.events.find_one({"event_id": event_id, "type": "primeiro_olhar"}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado")

    posts = await db.posts.find({"event_id": event_id}, {"_id": 0}).to_list(length=10)
    if not posts:
        return {"error": "Sem posts neste evento"}

    results = []
    for post in posts:
        pid = post["post_id"]
        total_votes = post.get("aprovo_count", 0) + post.get("desaprovo_count", 0)
        approval = round(post.get("aprovo_count", 0) / total_votes * 100) if total_votes > 0 else 0

        votes_cursor = db.votes.find({"post_id": pid}, {"_id": 0, "geo": 1})
        vote_docs = await votes_cursor.to_list(length=500)
        countries = [v.get("geo", {}).get("country", "Desconhecido") for v in vote_docs if v.get("geo")]

        results.append({
            "image_url": post.get("media", [{}])[0].get("url", ""),
            "image_index": post.get("image_index", 0),
            "total_votes": total_votes,
            "approval_rate": approval,
            "top_countries": list(set(countries))[:5],
        })

    results.sort(key=lambda x: x["approval_rate"], reverse=True)
    best_image = results[0] if results else None

    all_vote_words_cursor = db.votes.aggregate([
        {"$match": {"post_id": {"$in": [p["post_id"] for p in posts]}}},
        {"$lookup": {"from": "posts", "localField": "post_id", "foreignField": "post_id", "as": "post"}},
        {"$unwind": "$post"},
        {"$group": {"_id": "$post.word", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ])
    top_words = [{"word": d["_id"], "count": d["count"]} async for d in all_vote_words_cursor]

    brand_word = event.get("brand_intended_word", "")
    community_word = top_words[0]["word"] if top_words else "N/A"
    alignment = "alinhada" if brand_word.upper() == community_word.upper() else "desalinhada"

    diagnosis = (
        f"A marca pretendia transmitir '{brand_word}'. "
        f"O público respondeu '{community_word}'. "
        f"Percepção {alignment}."
    )

    total_participants = sum(r["total_votes"] for r in results)

    return {
        "event_id": event_id,
        "brand_name": event.get("brand_name"),
        "brand_intended_word": brand_word,
        "total_participants": total_participants,
        "best_image": best_image,
        "top_words": top_words,
        "diagnosis": diagnosis,
        "community_top_word": community_word,
        "alignment": alignment,
        "images_ranked": results,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# Mount sub‑routers from other modules
app.include_router(_pwd_auth.build_router(db, user_out), prefix="/api")
app.include_router(_ws_mod.build_router(db, get_current_user), prefix="/api")
app.include_router(api_router)


# ==============================
# GDPR / DATA EXPORT & DELETE
# ==============================
@api_router.get("/me/export")
async def export_my_data(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    uid = user["user_id"]

    # Collect all user data
    data = {
        "profile": user,
        "posts": await db.posts.find({"author_id": uid}, {"_id": 0}).to_list(length=1000),
        "votes": await db.votes.find({"user_id": uid}, {"_id": 0}).to_list(length=1000),
        "comments": await db.comments.find({"user_id": uid}, {"_id": 0}).to_list(length=1000),
        "workspaces": await db.workspaces.find({"owner_user_id": uid}, {"_id": 0}).to_list(length=100),
        "campaigns": await db.campaigns.find({"user_id": uid}, {"_id": 0}).to_list(length=100),
        "notifications": await db.notifications.find({"user_id": uid}, {"_id": 0}).to_list(length=500),
        "events_created": await db.events.find({"company_id": uid}, {"_id": 0}).to_list(length=100),
        "invoices": await db.invoices.find({"metadata.user_id": uid}, {"_id": 0}).to_list(length=100),
    }
    # Serialize dates
    for category, items in data.items():
        if isinstance(items, list):
            for item in items:
                for key, val in item.items():
                    if isinstance(val, datetime):
                        item[key] = val.isoformat()
        elif isinstance(items, dict):
            for key, val in items.items():
                if isinstance(val, datetime):
                    items[key] = val.isoformat()

    return data

@api_router.post("/me/delete")
async def delete_my_account(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    uid = user["user_id"]

    # Anonymise posts (keep content but remove author reference)
    await db.posts.update_many(
        {"author_id": uid},
        {"$set": {
            "author_id": "deleted_user",
            "author_name": "[apagado]",
            "author_picture": None,
        }}
    )
    # Anonymise comments
    await db.comments.update_many(
        {"user_id": uid},
        {"$set": {
            "user_id": "deleted_user",
            "user_name": "[apagado]",
            "user_picture": None,
        }}
    )
    # Remove votes (vote privacy)
    await db.votes.delete_many({"user_id": uid})
    # Remove sessions
    await db.user_sessions.delete_many({"user_id": uid})
    # Remove notifications
    await db.notifications.delete_many({"user_id": uid})
    # Remove password auth if exists
    await db.password_auth.delete_one({"user_id": uid})
    # Archive workspaces
    await db.workspaces.update_many(
        {"owner_user_id": uid},
        {"$set": {"deleted_at": datetime.now(timezone.utc).isoformat(), "name": "[apagado]"}}
    )
    # Remove user record
    await db.users.delete_one({"user_id": uid})

    return {"ok": True, "message": "Conta apagada. Os teus posts e comentários permanecem anonimizados."}

