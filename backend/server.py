import sys

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
# Corrige SSL handshake com MongoDB Atlas — adiciona parâmetros de conexão segura
if "mongodb.net" in mongo_url and "tlsAllowInvalidCertificates" not in mongo_url:
    separator = "&" if "?" in mongo_url else "?"
    mongo_url = f"{mongo_url}{separator}tlsAllowInvalidCertificates=true&retryWrites=true&w=majority"
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

class AuthResponse(BaseModel):
    token: str
    user: UserOut

class PostCreate(BaseModel):
    word: str
    image_base64: str
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
    is_sponsored: bool = False
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
        has_business=bool(user.get("business_profile")),
        is_admin=is_admin,
        age_confirmed=bool(user.get("age_confirmed_at")),
        birth_year=user.get("birth_year"),
        bw_balance=int(user.get("bw_balance", 0) or 0),
        bw_total_earned=int(user.get("bw_total_earned", 0) or 0),
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

    return PostOut(
        post_id=doc["post_id"],
        word=doc["word"],
        image_base64=doc["image_base64"],
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
    return user_out(user)


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

# ... (rest of routes remain the same)

# ==============================
# POSTS ROUTES
# ==============================

# ---------- LIST POSTS ----------
@api_router.get("/posts")
async def list_posts(
    sort: Literal["recent", "trending"] = Query("recent"),
    source: Optional[str] = Query(None),
    theme: Optional[str] = Query(None),
    scope: Literal["world", "country", "city"] = Query("world"),
    country_code: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_optional_user(authorization)
    current_user_id = user["user_id"] if user else None

    # Base match — never show hidden posts
    match: dict = {"hidden": {"$ne": True}}

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
        "author_id": user["user_id"],
        "author_name": user.get("name", ""),
        "author_picture": user.get("picture"),
        "created_at": now,
        "aprovo_count": 0,
        "desaprovo_count": 0,
        "comments_count": 0,
        "is_sponsored": False,
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
    if doc["hidden"]:
        raise HTTPException(status_code=404, detail="Post não encontrado.")

    existing = await db.votes.find_one({"post_id": post_id, "user_id": user["user_id"]}, {"_id": 0})
    now = datetime.now(timezone.utc)

    if existing:
        if existing["vote"] == payload.vote:
            # Toggle off
            await db.votes.delete_one({"post_id": post_id, "user_id": user["user_id"]})
            field = "aprovo_count" if payload.vote == "aprovo" else "desaprovo_count"
            await db.posts.update_one({"post_id": post_id}, {"$inc": {field: -1}})
        else:
            # Switch vote
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
        # New vote
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

    doc = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    return await serialize_post(doc, user["user_id"])


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
    if not user.get("business_profile"):
        raise HTTPException(status_code=403, detail="Precisas de criar um perfil de empresa primeiro.")

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

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        campaign_id = session.get("metadata", {}).get("campaign_id")
        if campaign_id:
            now = datetime.now(timezone.utc)
            await db.campaigns.update_one(
                {"campaign_id": campaign_id},
                {"$set": {
                    "status": "active",
                    "payment_intent": session.get("payment_intent"),
                    "paid_at": now,
                    "starts_at": now,
                    "ends_at": now + timedelta(days=30),  # Will be updated with actual duration
                }}
            )
            # Update campaign duration based on tier
            campaign = await db.campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
            if campaign:
                tier = TIERS.get(campaign.get("tier_key"))
                if tier:
                    await db.campaigns.update_one(
                        {"campaign_id": campaign_id},
                        {"$set": {"ends_at": now + timedelta(days=tier.duration_days)}}
                    )

    return {"ok": True}


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


# ==============================
# WORKS AND PASSWORD AUTH ROUTES
# ==============================
# These are handled by mounted sub-routers in password_auth.py and workspaces.py

app.include_router(api_router)
