from fastapi import FastAPI, APIRouter, HTTPException, Header, Query, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

stripe.api_key = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:3000")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "").lower()

app = FastAPI()
api_router = APIRouter(prefix="/api")

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

class AuthResponse(BaseModel):
    token: str
    user: UserOut

class PostCreate(BaseModel):
    word: str
    image_base64: str

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
@api_router.post("/auth/session", response_model=AuthResponse)
async def auth_session(payload: SessionRequest):
    async with httpx.AsyncClient(timeout=15.0) as http:
        try:
            resp = await http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": payload.session_id},
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Falha ao validar sessão: {e}")
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="session_id inválido")
    data = resp.json()
    email = (data.get("email") or "").strip().lower()
    name = data.get("name", email)
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=400, detail="Resposta de auth inválida")

    logger.info(f"Auth session: email={email} session_token_suffix=...{session_token[-8:]}")

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

    # SECURITY: delete any prior session with the SAME token (regardless of user)
    # to prevent stale-token cross-user contamination.
    await db.user_sessions.delete_many({"session_token": session_token})
    try:
        await db.user_sessions.insert_one({
            "session_token": session_token,
            "user_id": user["user_id"],
            "email_snapshot": email,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc),
        })
    except Exception as e:
        # Duplicate-key races (rapid concurrent OAuth callbacks): the prior
        # delete+insert may collide with another worker's insert. Idempotent
        # behaviour — the token is already there and points to this user.
        logger.warning(f"Auth session insert raced (ignored): {e}")
    return AuthResponse(token=session_token, user=user_out(user))


@api_router.post("/auth/apple", response_model=AuthResponse)
async def auth_apple(payload: AppleSignInRequest):
    """Apple Sign In: trust the identity_token from Expo client (already validated by Apple).
    For production strict validation, we'd verify the JWT signature against Apple's public keys.
    """
    if not payload.user_identifier:
        raise HTTPException(status_code=400, detail="user_identifier obrigatório")
    apple_id = payload.user_identifier
    # Apple often hides email on subsequent logins. Use user_identifier as key.
    user = await db.users.find_one({"apple_id": apple_id}, {"_id": 0})
    if not user:
        # Try by email if provided
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


# Portugal sets the GDPR-K consent age at 13. We also enforce a hard floor
# at 13 globally because COPPA (US) is identical and Google Play classifies
# 13+ as the minimum content rating for social UGC apps.
MIN_AGE_YEARS = 13


@api_router.post("/auth/confirm-age", response_model=UserOut)
async def auth_confirm_age(payload: AgeConfirmRequest,
                            authorization: Optional[str] = Header(None)):
    """Record the user's self-declared birth year and reject < MIN_AGE_YEARS.

    We deliberately store only the *year* — not the full DOB — to minimise
    PII while still meeting platform age-rating obligations.
    """
    user = await get_current_user(authorization)
    current_year = datetime.now(timezone.utc).year
    if payload.birth_year < 1900 or payload.birth_year > current_year:
        raise HTTPException(status_code=400, detail="Ano de nascimento inválido.")
    age = current_year - payload.birth_year
    if age < MIN_AGE_YEARS:
        # Mark the account as blocked rather than silently rejecting — so
        # we can audit attempts. We DO NOT delete the user (auditability).
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {
                "age_blocked_at": datetime.now(timezone.utc),
                "birth_year": payload.birth_year,
            }},
        )
        # Invalidate sessions for this user — kicks them out immediately.
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


# ---------- Debug / Audit ----------
@api_router.get("/auth/whoami")
async def whoami(authorization: Optional[str] = Header(None)):
    """Audit endpoint — returns who the server thinks you are, helpful for debugging account mix-ups."""
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


# ---------- Posts ----------
@api_router.post("/posts", response_model=PostOut)
async def create_post(payload: PostCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    word = payload.word.strip()
    if not WORD_RE.match(word):
        raise HTTPException(status_code=400, detail="A palavra deve conter apenas letras/números (sem espaços), até 20 caracteres.")
    ok, reason = moderate_word(word)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)
    if not payload.image_base64 or len(payload.image_base64) < 50:
        raise HTTPException(status_code=400, detail="Imagem é obrigatória.")

    post = {
        "post_id": f"post_{uuid.uuid4().hex[:12]}",
        "word": normalize_word(word),
        "image_base64": payload.image_base64,
        "author_id": user["user_id"],
        "author_name": user["name"],
        "author_picture": user.get("picture"),
        "created_at": datetime.now(timezone.utc),
        "aprovo_count": 0,
        "desaprovo_count": 0,
        "comments_count": 0,
        "reports_count": 0,
        "hidden": False,
        "is_sponsored": False,
    }
    await db.posts.insert_one(post.copy())
    return await serialize_post(post, user["user_id"])


def matches_target(campaign: dict, geo: dict) -> bool:
    """Check if user's geo matches the campaign's scope."""
    scope = campaign.get("scope")
    if scope == "world":
        return True
    if scope == "country":
        return bool(geo.get("country_code")) and geo["country_code"] == campaign.get("target_country_code")
    if scope == "region":
        return (geo.get("country_code") == campaign.get("target_country_code")
                and geo.get("region") and campaign.get("target_region")
                and geo["region"].lower() == campaign["target_region"].lower())
    if scope == "city":
        return (geo.get("country_code") == campaign.get("target_country_code")
                and geo.get("city") and campaign.get("target_city")
                and geo["city"].lower() == campaign["target_city"].lower())
    return False


async def pick_sponsored_for_user(user_id: Optional[str], geo: dict, exclude_ids: set) -> Optional[dict]:
    """Return one active sponsored post matching user's geo, not already shown."""
    now = datetime.now(timezone.utc)
    query = {"is_sponsored": True, "hidden": {"$ne": True}, "post_id": {"$nin": list(exclude_ids)}}
    cursor = db.posts.find(query, {"_id": 0})
    candidates = await cursor.to_list(length=50)
    # Filter by active campaign + geo match
    matched = []
    for p in candidates:
        camp = await db.campaigns.find_one({"campaign_id": p.get("campaign_id")}, {"_id": 0})
        if not camp:
            continue
        if camp.get("status") != "active":
            continue
        ends = camp.get("ends_at")
        if ends and isinstance(ends, datetime):
            if ends.tzinfo is None:
                ends = ends.replace(tzinfo=timezone.utc)
            if ends < now:
                continue
        if matches_target(camp, geo):
            matched.append(p)
    if not matched:
        return None
    return random.choice(matched)


@api_router.get("/posts", response_model=List[PostOut])
async def list_posts(
    request: Request,
    authorization: Optional[str] = Header(None),
    sort: Literal["recent", "trending"] = Query("recent"),
    word: Optional[str] = Query(None),
):
    user = await get_optional_user(authorization)
    current_user_id = user["user_id"] if user else None

    query: dict = {"hidden": {"$ne": True}, "is_sponsored": {"$ne": True}}
    if word:
        query["word"] = normalize_word(word)

    if sort == "trending":
        pipeline = [
            {"$match": query},
            {"$addFields": {"engagement": {"$add": ["$aprovo_count", "$desaprovo_count", "$comments_count"]}}},
            {"$sort": {"engagement": -1, "created_at": -1}},
            {"$limit": 100},
            {"$project": {"_id": 0}},
        ]
        organic = await db.posts.aggregate(pipeline).to_list(length=100)
    else:
        cursor = db.posts.find(query, {"_id": 0}).sort("created_at", -1).limit(100)
        organic = await cursor.to_list(length=100)

    # If filtering by word OR no posts, skip sponsored injection
    if word:
        return [await serialize_post(d, current_user_id) for d in organic]

    # Sponsored injection: 1 every 3 organic posts
    ip = get_client_ip(dict(request.headers))
    geo = await geo_lookup(ip)
    used_sponsored: set = set()
    result: list = []
    for idx, p in enumerate(organic):
        result.append(p)
        if (idx + 1) % 3 == 0:
            sponsored = await pick_sponsored_for_user(current_user_id, geo, used_sponsored)
            if sponsored:
                used_sponsored.add(sponsored["post_id"])
                result.append(sponsored)

    return [await serialize_post(d, current_user_id) for d in result]


@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    if post["author_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    if post.get("is_sponsored"):
        raise HTTPException(status_code=400, detail="Posts patrocinados são gerenciados via campanha.")
    await db.posts.delete_one({"post_id": post_id})
    await db.votes.delete_many({"post_id": post_id})
    await db.comments.delete_many({"post_id": post_id})
    await db.reports.delete_many({"post_id": post_id})
    return {"ok": True}


# ---------- Votes ----------
@api_router.post("/posts/{post_id}/vote", response_model=PostOut)
async def vote_post(post_id: str, payload: VoteRequest, request: Request, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")

    ip = get_client_ip(dict(request.headers))
    geo = await geo_lookup(ip)

    existing = await db.votes.find_one({"post_id": post_id, "user_id": user["user_id"]}, {"_id": 0})
    new_vote = payload.vote
    if existing and existing["vote"] == new_vote:
        await db.votes.delete_one({"post_id": post_id, "user_id": user["user_id"]})
        await db.posts.update_one({"post_id": post_id}, {"$inc": {f"{new_vote}_count": -1}})
        # decrement campaign stats if sponsored
        if post.get("campaign_id"):
            await db.campaigns.update_one({"campaign_id": post["campaign_id"]},
                                           {"$inc": {f"{new_vote}_count": -1, "votes_collected": -1}})
    elif existing:
        await db.votes.update_one(
            {"post_id": post_id, "user_id": user["user_id"]},
            {"$set": {"vote": new_vote, "updated_at": datetime.now(timezone.utc), "geo": geo}},
        )
        await db.posts.update_one({"post_id": post_id},
                                  {"$inc": {f"{new_vote}_count": 1, f"{existing['vote']}_count": -1}})
        if post.get("campaign_id"):
            await db.campaigns.update_one({"campaign_id": post["campaign_id"]},
                                           {"$inc": {f"{new_vote}_count": 1, f"{existing['vote']}_count": -1}})
    else:
        await db.votes.insert_one({
            "post_id": post_id, "user_id": user["user_id"], "vote": new_vote,
            "geo": geo, "created_at": datetime.now(timezone.utc),
        })
        await db.posts.update_one({"post_id": post_id}, {"$inc": {f"{new_vote}_count": 1}})
        if post.get("campaign_id"):
            await db.campaigns.update_one({"campaign_id": post["campaign_id"]},
                                           {"$inc": {f"{new_vote}_count": 1, "votes_collected": 1}})
            # Milestone email check (50/75/100% of included_votes goal)
            await _maybe_send_milestone(post["campaign_id"])

    updated = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    return await serialize_post(updated, user["user_id"])


async def _maybe_send_milestone(campaign_id: str) -> None:
    """Check if vote count crossed any milestone (50/75/100%) and send email idempotently."""
    try:
        camp = await db.campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
        if not camp or camp.get("status") != "active":
            return
        target = camp.get("included_votes") or 0
        if target <= 0:
            return
        new_count = camp.get("votes_collected") or 0
        prev_count = max(0, new_count - 1)
        new_milestones = crossed_milestones(prev_count, new_count, target)
        if not new_milestones:
            return
        already_sent = set(camp.get("milestones_sent") or [])
        to_send = [m for m in new_milestones if m not in already_sent]
        if not to_send:
            return
        # Lookup advertiser email
        owner = await db.users.find_one({"user_id": camp["user_id"]}, {"_id": 0})
        to_email = (camp.get("business_profile") or {}).get("contact_email") \
                   or (owner.get("business_profile") or {}).get("contact_email") if owner else None
        if not to_email and owner:
            to_email = owner.get("email")
        if not to_email:
            return
        aprovo_pct = round((camp.get("aprovo_count", 0) / max(1, new_count)) * 100)
        for m in to_send:
            send_milestone_email(
                to_email=to_email,
                milestone=m,
                word=camp["word"],
                votes_collected=new_count,
                included_votes=target,
                aprovo_pct=aprovo_pct,
                campaign_id=campaign_id,
            )
        await db.campaigns.update_one(
            {"campaign_id": campaign_id},
            {"$addToSet": {"milestones_sent": {"$each": to_send}}},
        )
    except Exception as e:
        logger.error(f"Milestone email check failed for {campaign_id}: {e}")


# ---------- Comments ----------
@api_router.get("/posts/{post_id}/comments", response_model=List[CommentOut])
async def list_comments(post_id: str):
    cursor = db.comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", -1).limit(200)
    docs = await cursor.to_list(length=200)
    return [comment_doc_to_out(d) for d in docs]


@api_router.post("/posts/{post_id}/comment", response_model=PostOut)
async def comment_post(post_id: str, payload: CommentCreate, request: Request,
                       authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")

    word = payload.word.strip()
    if not WORD_RE.match(word):
        raise HTTPException(status_code=400, detail="O comentário deve ser UMA palavra (letras/números, até 20).")
    ok, reason = moderate_word(word)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)

    normalized = normalize_word(word)
    ip = get_client_ip(dict(request.headers))
    geo = await geo_lookup(ip)

    existing = await db.comments.find_one({"post_id": post_id, "user_id": user["user_id"]}, {"_id": 0})
    if existing:
        await db.comments.update_one(
            {"comment_id": existing["comment_id"]},
            {"$set": {"word": normalized, "updated_at": datetime.now(timezone.utc),
                      "user_name": user["name"], "user_picture": user.get("picture"), "geo": geo}},
        )
    else:
        await db.comments.insert_one({
            "comment_id": f"cmt_{uuid.uuid4().hex[:12]}",
            "post_id": post_id, "user_id": user["user_id"],
            "user_name": user["name"], "user_picture": user.get("picture"),
            "word": normalized, "geo": geo,
            "created_at": datetime.now(timezone.utc),
        })
        await db.posts.update_one({"post_id": post_id}, {"$inc": {"comments_count": 1}})

    updated = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    return await serialize_post(updated, user["user_id"])


@api_router.delete("/posts/{post_id}/comment", response_model=PostOut)
async def delete_my_comment(post_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    res = await db.comments.delete_one({"post_id": post_id, "user_id": user["user_id"]})
    if res.deleted_count > 0:
        await db.posts.update_one({"post_id": post_id}, {"$inc": {"comments_count": -1}})
    updated = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    return await serialize_post(updated, user["user_id"])


# ---------- Reports ----------
REPORT_HIDE_THRESHOLD = 3

@api_router.post("/posts/{post_id}/report")
async def report_post(post_id: str, payload: ReportCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    existing = await db.reports.find_one({"post_id": post_id, "user_id": user["user_id"]}, {"_id": 0})
    if existing:
        return {"ok": True, "already_reported": True}
    await db.reports.insert_one({
        "report_id": f"rep_{uuid.uuid4().hex[:12]}", "post_id": post_id, "user_id": user["user_id"],
        "reason": (payload.reason or "")[:200], "created_at": datetime.now(timezone.utc),
    })
    updated = await db.posts.find_one_and_update(
        {"post_id": post_id}, {"$inc": {"reports_count": 1}}, return_document=True,
    )
    hidden = False
    if updated and updated.get("reports_count", 0) >= REPORT_HIDE_THRESHOLD:
        await db.posts.update_one({"post_id": post_id}, {"$set": {"hidden": True}})
        hidden = True
    return {"ok": True, "hidden": hidden}


# ---------- Words ----------
@api_router.get("/words/{word}/stats")
async def word_stats(word: str):
    normalized = normalize_word(word)
    count = await db.posts.count_documents({"word": normalized, "hidden": {"$ne": True}})
    agg = await db.posts.aggregate([
        {"$match": {"word": normalized, "hidden": {"$ne": True}}},
        {"$group": {"_id": None, "aprovo": {"$sum": "$aprovo_count"}, "desaprovo": {"$sum": "$desaprovo_count"}}},
    ]).to_list(length=1)
    aprovo = int(agg[0]["aprovo"]) if agg else 0
    desaprovo = int(agg[0]["desaprovo"]) if agg else 0
    return {"word": normalized, "posts_count": count, "aprovo_total": aprovo, "desaprovo_total": desaprovo}


# ---------- Business Profile ----------
@api_router.post("/business/profile", response_model=UserOut)
async def create_business_profile(payload: BusinessProfileCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not payload.company_name.strip() or not payload.contact_email.strip() or not payload.country_code.strip():
        raise HTTPException(status_code=400, detail="Campos obrigatórios faltando.")
    profile = {
        "company_name": payload.company_name.strip(),
        "country": payload.country.strip(),
        "country_code": payload.country_code.strip().upper(),
        "tax_id": (payload.tax_id or "").strip() or None,
        "contact_email": payload.contact_email.strip(),
        "contact_name": payload.contact_name.strip(),
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"business_profile": profile}})
    user["business_profile"] = profile
    return user_out(user)


@api_router.get("/business/profile")
async def get_business_profile(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    return user.get("business_profile") or {}


# ---------- Campaigns ----------
async def apply_tier_overrides() -> None:
    """Pull tier overrides from db.tier_overrides and apply to the in-memory TIERS dict.
    Called by every endpoint that prices a campaign so admin changes take effect immediately."""
    try:
        overrides = await db.tier_overrides.find({}, {"_id": 0}).to_list(length=100)
    except Exception:
        overrides = []
    for ov in overrides:
        key = ov.get("tier_key")
        if key in TIERS:
            t = TIERS[key]
            if "amount_cents" in ov and isinstance(ov["amount_cents"], int) and ov["amount_cents"] > 0:
                t.amount_cents = ov["amount_cents"]
            if "included_votes" in ov and isinstance(ov["included_votes"], int) and ov["included_votes"] > 0:
                t.included_votes = ov["included_votes"]


@api_router.get("/business/tiers")
async def list_tiers():
    await apply_tier_overrides()
    return tiers_public()


@api_router.post("/business/campaigns", response_model=CampaignOut)
async def create_campaign(payload: CampaignCreate, request: Request, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user.get("business_profile"):
        raise HTTPException(status_code=400, detail="Crie o perfil empresarial primeiro.")
    # Honour admin tier-price overrides before pricing the new campaign.
    await apply_tier_overrides()

    word = payload.word.strip()
    if not WORD_RE.match(word):
        raise HTTPException(status_code=400, detail="Palavra inválida.")
    ok, reason = moderate_word(word)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)
    if not payload.image_base64 or len(payload.image_base64) < 50:
        raise HTTPException(status_code=400, detail="Imagem obrigatória.")
    try:
        tier = get_tier(payload.tier_key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Validate target fields based on scope
    if tier.scope == "country" and not payload.target_country_code:
        raise HTTPException(status_code=400, detail="País alvo obrigatório.")
    if tier.scope == "region" and (not payload.target_country_code or not payload.target_region):
        raise HTTPException(status_code=400, detail="País e região alvos obrigatórios.")
    if tier.scope == "city" and (not payload.target_country_code or not payload.target_city):
        raise HTTPException(status_code=400, detail="País e cidade alvos obrigatórios.")

    campaign_id = f"camp_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    # Apply promo code if provided
    final_amount_cents = tier.amount_cents
    promo_applied = None
    if payload.promo_code:
        code = payload.promo_code.strip().upper()
        promo = await db.promo_codes.find_one({"code": code, "active": {"$ne": False}}, {"_id": 0})
        if not promo:
            raise HTTPException(status_code=400, detail=f"Código '{code}' inválido")
        if promo.get("expires_at"):
            exp = promo["expires_at"]
            if isinstance(exp, datetime):
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                if exp < now:
                    raise HTTPException(status_code=400, detail=f"Código '{code}' expirado")
        if promo.get("max_uses") and promo.get("uses", 0) >= promo["max_uses"]:
            raise HTTPException(status_code=400, detail=f"Código '{code}' esgotado")
        discount_pct = int(promo["discount_pct"])
        final_amount_cents = int(round(tier.amount_cents * (100 - discount_pct) / 100))
        if final_amount_cents < 50:  # Stripe minimum
            final_amount_cents = 50
        promo_applied = {"code": code, "discount_pct": discount_pct}

    campaign = {
        "campaign_id": campaign_id,
        "user_id": user["user_id"],
        "company_name": user["business_profile"]["company_name"],
        "word": normalize_word(word),
        "image_base64": payload.image_base64,
        "tier_key": tier.key,
        "scope": tier.scope,
        "duration_days": tier.duration_days,
        "amount_cents": final_amount_cents,
        "base_amount_cents": tier.amount_cents,
        "promo": promo_applied,
        "included_votes": tier.included_votes,
        "target_country_code": (payload.target_country_code or "").upper() or None,
        "target_region": payload.target_region,
        "target_city": payload.target_city,
        "status": "pending_payment",
        "votes_collected": 0,
        "aprovo_count": 0,
        "desaprovo_count": 0,
        "created_at": now,
        "post_id": None,
        "starts_at": None,
        "ends_at": None,
        "stripe_session_id": None,
        "checkout_url": None,
    }

    # Create Stripe Checkout Session (or mock if placeholder key)
    success_url = f"{APP_BASE_URL}/business/campaign/{campaign_id}?paid=1"
    cancel_url = f"{APP_BASE_URL}/business/campaign/{campaign_id}?canceled=1"
    is_mock_key = stripe.api_key in ("sk_test_emergent", "", None)
    if is_mock_key:
        mock_session_id = f"cs_test_mock_{uuid.uuid4().hex[:16]}"
        campaign["stripe_session_id"] = mock_session_id
        campaign["checkout_url"] = f"{APP_BASE_URL}/business/campaign/{campaign_id}?paid=1&mock=1"
        campaign["_mock"] = True
    else:
        try:
            session = stripe.checkout.Session.create(
                mode="payment",
                line_items=[{
                    "price_data": {
                        "currency": "eur",
                        "unit_amount": final_amount_cents,
                        "product_data": {
                            "name": f"Besord {tier.name} — #{normalize_word(word)}" + (f" ({promo_applied['discount_pct']}% off)" if promo_applied else ""),
                            "description": f"{tier.scope.upper()} • {tier.duration_days}d • {tier.included_votes} votos incl.",
                        },
                    },
                    "quantity": 1,
                }],
                success_url=success_url,
                cancel_url=cancel_url,
                metadata={"campaign_id": campaign_id, "user_id": user["user_id"], "tier_key": tier.key, "promo_code": (promo_applied or {}).get("code", "")},
                payment_intent_data={"metadata": {"campaign_id": campaign_id}},
                customer_email=user["business_profile"].get("contact_email") or user["email"],
            )
            campaign["stripe_session_id"] = session.id
            campaign["checkout_url"] = session.url
        except Exception as e:
            logger.error(f"Stripe checkout creation failed: {e}")
            raise HTTPException(status_code=502, detail=f"Falha ao criar pagamento: {str(e)[:120]}")

    await db.campaigns.insert_one(campaign.copy())
    # Audit log — immutable record of what was submitted (proves no later substitution)
    await db.campaign_audit.insert_one({
        "campaign_id": campaign_id,
        "user_id": user["user_id"],
        "event": "create",
        "word_submitted": word,                       # raw user input
        "word_stored": normalize_word(word),          # what we save
        "tier_key": tier.key,
        "scope": tier.scope,
        "target_country_code": campaign["target_country_code"],
        "target_region": campaign["target_region"],
        "target_city": campaign["target_city"],
        "amount_cents": final_amount_cents,
        "base_amount_cents": tier.amount_cents,
        "promo_code": (promo_applied or {}).get("code"),
        "image_sha256": __import__("hashlib").sha256(payload.image_base64.encode()).hexdigest()[:32],
        "client_ip": get_client_ip(dict(request.headers)),
        "created_at": now,
    })
    # Increment promo usage
    if promo_applied:
        await db.promo_codes.update_one({"code": promo_applied["code"]}, {"$inc": {"uses": 1}})
    return serialize_campaign(campaign)


@api_router.post("/business/campaigns/{campaign_id}/check-payment", response_model=CampaignOut)
async def check_campaign_payment(campaign_id: str, authorization: Optional[str] = Header(None)):
    """Poll Stripe for payment status; if paid, activate campaign + create sponsored post."""
    user = await get_current_user(authorization)
    campaign = await db.campaigns.find_one({"campaign_id": campaign_id, "user_id": user["user_id"]}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")

    if campaign["status"] in ("active", "completed"):
        return serialize_campaign(campaign)

    session_id = campaign.get("stripe_session_id")
    if not session_id:
        return serialize_campaign(campaign)

    # Mock mode: any check counts as paid
    is_mock = session_id.startswith("cs_test_mock_") or stripe.api_key in ("sk_test_emergent", "", None)

    paid = False
    if is_mock:
        paid = True
    else:
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            paid = session.payment_status == "paid"
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Erro ao consultar Stripe: {e}")

    if paid:
        # Activate campaign
        now = datetime.now(timezone.utc)
        ends = now + timedelta(days=campaign["duration_days"])
        # Create sponsored post
        post_id = f"post_{uuid.uuid4().hex[:12]}"
        post = {
            "post_id": post_id,
            "word": campaign["word"],
            "image_base64": campaign["image_base64"],
            "author_id": user["user_id"],
            "author_name": campaign["company_name"],
            "author_picture": user.get("picture"),
            "created_at": now,
            "aprovo_count": 0,
            "desaprovo_count": 0,
            "comments_count": 0,
            "reports_count": 0,
            "hidden": False,
            "is_sponsored": True,
            "campaign_id": campaign_id,
        }
        await db.posts.insert_one(post.copy())
        await db.campaigns.update_one(
            {"campaign_id": campaign_id},
            {"$set": {"status": "active", "starts_at": now, "ends_at": ends,
                      "post_id": post_id, "paid_at": now}},
        )
        campaign.update({"status": "active", "starts_at": now, "ends_at": ends, "post_id": post_id})

    return serialize_campaign(campaign)


@api_router.get("/business/campaigns", response_model=List[CampaignOut])
async def list_my_campaigns(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    cursor = db.campaigns.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1)
    docs = await cursor.to_list(length=100)
    # Auto-complete expired
    now = datetime.now(timezone.utc)
    for c in docs:
        if c.get("status") == "active" and c.get("ends_at"):
            ends = c["ends_at"]
            if isinstance(ends, datetime):
                if ends.tzinfo is None:
                    ends = ends.replace(tzinfo=timezone.utc)
                if ends < now:
                    await db.campaigns.update_one({"campaign_id": c["campaign_id"]}, {"$set": {"status": "completed"}})
                    c["status"] = "completed"
    return [serialize_campaign(c) for c in docs]


@api_router.get("/business/campaigns/{campaign_id}", response_model=CampaignOut)
async def get_campaign(campaign_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    c = await db.campaigns.find_one({"campaign_id": campaign_id, "user_id": user["user_id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    return serialize_campaign(c)


@api_router.post("/business/campaigns/{campaign_id}/cancel", response_model=CampaignOut)
async def advertiser_cancel_campaign(campaign_id: str, authorization: Optional[str] = Header(None)):
    """The advertiser cancels their own campaign. **No refund** — the campaign
    simply stops being shown to users (the post is also hidden from the feed).
    Already-canceled campaigns are returned as-is (idempotent)."""
    user = await get_current_user(authorization)
    c = await db.campaigns.find_one({"campaign_id": campaign_id, "user_id": user["user_id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    if c.get("status") == "canceled":
        return serialize_campaign(c)

    now = datetime.now(timezone.utc)
    await db.campaigns.update_one(
        {"campaign_id": campaign_id},
        {"$set": {
            "status": "canceled",
            "canceled_at": now,
            "canceled_by": "advertiser",
            "cancel_reason": "advertiser_request",
            "refunded": False,
        }},
    )
    # Also hide the underlying post from public feed (campaign is gone, ad shouldn't show).
    if c.get("post_id"):
        await db.posts.update_one(
            {"post_id": c["post_id"]},
            {"$set": {"hidden": True, "hidden_at": now, "hidden_by": "advertiser_cancel"}},
        )
    # Audit log
    await db.campaign_audit.insert_one({
        "campaign_id": campaign_id,
        "user_id": user["user_id"],
        "event": "advertiser_cancel",
        "no_refund": True,
        "previous_status": c.get("status"),
        "created_at": now,
    })

    c = await db.campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
    return serialize_campaign(c)


@api_router.get("/business/campaigns/{campaign_id}/report")
async def campaign_report(campaign_id: str, authorization: Optional[str] = Header(None)):
    """Aggregate votes & comments by region. Returns regional breakdown + word cloud."""
    user = await get_current_user(authorization)
    c = await db.campaigns.find_one({"campaign_id": campaign_id, "user_id": user["user_id"]}, {"_id": 0})
    if not c or not c.get("post_id"):
        raise HTTPException(status_code=404, detail="Campanha sem dados")

    post_id = c["post_id"]

    async def agg_votes(field: str):
        pipeline = [
            {"$match": {"post_id": post_id, f"geo.{field}": {"$ne": None}}},
            {"$group": {"_id": f"$geo.{field}",
                        "aprovo": {"$sum": {"$cond": [{"$eq": ["$vote", "aprovo"]}, 1, 0]}},
                        "desaprovo": {"$sum": {"$cond": [{"$eq": ["$vote", "desaprovo"]}, 1, 0]}},
                        "total": {"$sum": 1}}},
            {"$sort": {"total": -1}},
            {"$limit": 100},
        ]
        return await db.votes.aggregate(pipeline).to_list(length=100)

    by_country = await agg_votes("country")
    by_region = await agg_votes("region")
    by_city = await agg_votes("city")

    def fmt(rows):
        """Reshape aggregate rows for the response: rename _id -> name, add aprovo_pct."""
        out = []
        for r in rows:
            total = r.get("total", 0) or 0
            aprovo = r.get("aprovo", 0) or 0
            out.append({
                "name": r.get("_id"),
                "aprovo": aprovo,
                "desaprovo": r.get("desaprovo", 0) or 0,
                "total": total,
                "aprovo_pct": round(aprovo / total * 100) if total else 0,
            })
        return out

    # Geo points for heatmap: lat/lon + vote type
    geo_points_cursor = db.votes.find(
        {"post_id": post_id, "geo.lat": {"$ne": None}, "geo.lon": {"$ne": None}},
        {"_id": 0, "vote": 1, "geo.lat": 1, "geo.lon": 1, "geo.city": 1, "geo.country_code": 1},
    ).limit(2000)
    geo_docs = await geo_points_cursor.to_list(length=2000)
    geo_points = [
        {
            "lat": float(d["geo"]["lat"]),
            "lon": float(d["geo"]["lon"]),
            "vote": d.get("vote"),
            "city": d.get("geo", {}).get("city"),
            "country_code": d.get("geo", {}).get("country_code"),
        }
        for d in geo_docs
        if d.get("geo", {}).get("lat") is not None and d.get("geo", {}).get("lon") is not None
    ]

    # Word cloud from comments (full list)
    cloud_pipeline = [
        {"$match": {"post_id": post_id}},
        {"$group": {"_id": "$word", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 30},
    ]
    word_cloud = await db.comments.aggregate(cloud_pipeline).to_list(length=30)
    total_comments = sum(w["count"] for w in word_cloud) or 1

    # Top 3 with percentage share + SENTIMENT per word (how the commenters voted)
    async def word_sentiment(word: str) -> dict:
        # Find votes from users who used this word in their comment
        commenter_ids = await db.comments.distinct("user_id", {"post_id": post_id, "word": word})
        if not commenter_ids:
            return {"aprovo": 0, "desaprovo": 0, "aprovo_pct": 0, "votes": 0}
        votes = await db.votes.find({"post_id": post_id, "user_id": {"$in": commenter_ids}}, {"_id": 0, "vote": 1}).to_list(length=len(commenter_ids))
        aprovo = sum(1 for v in votes if v.get("vote") == "aprovo")
        desaprovo = sum(1 for v in votes if v.get("vote") == "desaprovo")
        total_v = aprovo + desaprovo
        return {"aprovo": aprovo, "desaprovo": desaprovo, "votes": total_v,
                "aprovo_pct": round(aprovo / total_v * 100) if total_v else 0}

    top_3_words = []
    for w in word_cloud[:3]:
        sent = await word_sentiment(w["_id"])
        top_3_words.append({
            "word": w["_id"], "count": w["count"],
            "pct": round(w["count"] / total_comments * 100),
            "sentiment": sent,
        })

    # Compute aprovo_pct early — used by BENCHMARK + RE-TARGETING + executive summary below
    aprovo_pct = round(c.get("aprovo_count", 0) / max(1, c.get("votes_collected", 1)) * 100) if c.get("votes_collected") else 0

    # BENCHMARK: platform-wide average aprovo_pct (excluding this campaign's post)
    platform_agg = await db.posts.aggregate([
        {"$match": {"hidden": {"$ne": True}, "post_id": {"$ne": post_id},
                    "$expr": {"$gt": [{"$add": ["$aprovo_count", "$desaprovo_count"]}, 0]}}},
        {"$group": {"_id": None,
                    "aprovo": {"$sum": "$aprovo_count"},
                    "total": {"$sum": {"$add": ["$aprovo_count", "$desaprovo_count"]}}}},
    ]).to_list(length=1)
    platform_avg = round(platform_agg[0]["aprovo"] / platform_agg[0]["total"] * 100) if platform_agg and platform_agg[0]["total"] else 50
    benchmark_delta = aprovo_pct - platform_avg
    benchmark = {
        "platform_avg_aprovo_pct": platform_avg,
        "your_aprovo_pct": aprovo_pct,
        "delta": benchmark_delta,
        "label": f"{abs(benchmark_delta)} pts {'ACIMA' if benchmark_delta >= 0 else 'ABAIXO'} da média",
    }

    # RE-TARGETING offer
    desaprovo_pct = 100 - aprovo_pct if c.get("votes_collected") else 0
    retarget = None
    if desaprovo_pct >= 20 and c.get("votes_collected", 0) >= 20:
        retarget = {
            "available": True,
            "desaprovo_pct": desaprovo_pct,
            "discount_pct": 20,
            "promo_code": f"RETARGET-{campaign_id[-6:].upper()}",
            "cta": f"Volta a anunciar para os {desaprovo_pct}% que desaprovaram com 20% off — investiga o motivo.",
        }
        # Ensure promo code exists in DB
        await db.promo_codes.update_one(
            {"code": retarget["promo_code"]},
            {"$set": {"code": retarget["promo_code"], "discount_pct": 20, "max_uses": 1, "uses": 0,
                      "expires_at": None, "active": True, "linked_user_id": c["user_id"],
                      "created_at": datetime.now(timezone.utc)}},
            upsert=True,
        )

    # Pace & time metrics
    now = datetime.now(timezone.utc)
    starts = c.get("starts_at")
    ends = c.get("ends_at")
    days_active = 0.0
    days_remaining = 0.0
    if starts and isinstance(starts, datetime):
        starts_tz = starts if starts.tzinfo else starts.replace(tzinfo=timezone.utc)
        days_active = max(0.01, (now - starts_tz).total_seconds() / 86400)
    if ends and isinstance(ends, datetime):
        ends_tz = ends if ends.tzinfo else ends.replace(tzinfo=timezone.utc)
        days_remaining = max(0.0, (ends_tz - now).total_seconds() / 86400)

    votes_per_day = round(c.get("votes_collected", 0) / days_active, 1) if days_active > 0 else 0
    projected_total = round(c.get("votes_collected", 0) + votes_per_day * days_remaining)

    # Executive summary
    if aprovo_pct >= 75:
        verdict_tag = "MUITO APROVADO"
    elif aprovo_pct >= 55:
        verdict_tag = "APROVADO"
    elif aprovo_pct >= 45:
        verdict_tag = "DIVIDIDO"
    elif aprovo_pct >= 25:
        verdict_tag = "DESAPROVADO"
    else:
        verdict_tag = "MUITO DESAPROVADO"

    top_word = top_3_words[0]["word"] if top_3_words else None
    summary = (
        f"O teu post foi {verdict_tag.lower()} ({aprovo_pct}% aprovo) "
        f"com {c.get('votes_collected', 0)} votos"
        + (f" e a palavra mais associada é '{top_word}'." if top_word else ".")
    )

    return {
        "campaign_id": campaign_id,
        "post_id": post_id,
        "total_votes": c.get("votes_collected", 0),
        "aprovo_count": c.get("aprovo_count", 0),
        "desaprovo_count": c.get("desaprovo_count", 0),
        "aprovo_pct": aprovo_pct,
        "verdict_tag": verdict_tag,
        "summary": summary,
        "by_country": fmt(by_country),
        "by_region": fmt(by_region),
        "by_city": fmt(by_city),
        "geo_points": geo_points,
        "word_cloud": [{"word": w["_id"], "count": w["count"]} for w in word_cloud],
        "top_3_words": top_3_words,
        "total_comments": sum(w["count"] for w in word_cloud),
        "benchmark": benchmark,
        "retarget": retarget,
        "pace": {
            "votes_per_day": votes_per_day,
            "days_active": round(days_active, 1),
            "days_remaining": round(days_remaining, 1),
            "projected_total": projected_total,
            "target": c.get("included_votes", 0),
            "on_track": projected_total >= c.get("included_votes", 0),
        },
        "scope": c["scope"],
        "duration_days": c["duration_days"],
        "starts_at": c["starts_at"].isoformat() if c.get("starts_at") else None,
        "ends_at": c["ends_at"].isoformat() if c.get("ends_at") else None,
    }


@api_router.post("/business/campaigns/{campaign_id}/renew")
async def renew_campaign(campaign_id: str, authorization: Optional[str] = Header(None)):
    """Auto-renew with 10% loyalty discount. Creates a NEW pending campaign cloning this one."""
    user = await get_current_user(authorization)
    original = await db.campaigns.find_one({"campaign_id": campaign_id, "user_id": user["user_id"]}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    if original["status"] != "completed":
        raise HTTPException(status_code=400, detail="Só campanhas concluídas podem ser renovadas")

    try:
        tier = get_tier(original["tier_key"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 10% loyalty discount
    final_amount_cents = int(round(tier.amount_cents * 0.9))
    new_campaign_id = f"camp_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    campaign = {
        "campaign_id": new_campaign_id, "user_id": user["user_id"],
        "company_name": original["company_name"], "word": original["word"], "image_base64": original["image_base64"],
        "tier_key": tier.key, "scope": tier.scope, "duration_days": tier.duration_days,
        "amount_cents": final_amount_cents, "base_amount_cents": tier.amount_cents,
        "promo": {"code": "RENEW10", "discount_pct": 10}, "included_votes": tier.included_votes,
        "target_country_code": original.get("target_country_code"), "target_region": original.get("target_region"),
        "target_city": original.get("target_city"), "status": "pending_payment",
        "votes_collected": 0, "aprovo_count": 0, "desaprovo_count": 0,
        "created_at": now, "renewed_from": campaign_id,
        "post_id": None, "starts_at": None, "ends_at": None,
        "stripe_session_id": None, "checkout_url": None,
    }

    success_url = f"{APP_BASE_URL}/business/campaign/{new_campaign_id}?paid=1"
    cancel_url = f"{APP_BASE_URL}/business/campaign/{new_campaign_id}?canceled=1"
    is_mock_key = stripe.api_key in ("sk_test_emergent", "", None)
    if is_mock_key:
        campaign["stripe_session_id"] = f"cs_test_mock_{uuid.uuid4().hex[:16]}"
        campaign["checkout_url"] = f"{APP_BASE_URL}/business/campaign/{new_campaign_id}?paid=1&mock=1"
    else:
        try:
            session = stripe.checkout.Session.create(
                mode="payment",
                line_items=[{"price_data": {"currency": "eur", "unit_amount": final_amount_cents,
                                            "product_data": {"name": f"Besord {tier.name} — #{original['word']} (RENEW 10% off)",
                                                             "description": f"{tier.scope.upper()} • {tier.duration_days}d • {tier.included_votes} votos"}},
                             "quantity": 1}],
                success_url=success_url, cancel_url=cancel_url,
                metadata={"campaign_id": new_campaign_id, "renewed_from": campaign_id, "user_id": user["user_id"]},
                customer_email=user["business_profile"].get("contact_email") or user["email"],
            )
            campaign["stripe_session_id"] = session.id
            campaign["checkout_url"] = session.url
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Falha ao criar pagamento: {str(e)[:120]}")

    await db.campaigns.insert_one(campaign.copy())
    return serialize_campaign(campaign)


@api_router.post("/business/campaigns/{campaign_id}/retarget")
async def retarget_campaign(campaign_id: str, authorization: Optional[str] = Header(None)):
    """Creates a new campaign reusing the retarget promo code (20% off)."""
    user = await get_current_user(authorization)
    original = await db.campaigns.find_one({"campaign_id": campaign_id, "user_id": user["user_id"]}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    promo_code = f"RETARGET-{campaign_id[-6:].upper()}"
    # Just return the promo so frontend redirects to new campaign flow with code pre-applied
    return {"promo_code": promo_code, "discount_pct": 20, "scope_hint": original["scope"],
            "target_country_code": original.get("target_country_code"), "target_region": original.get("target_region"),
            "target_city": original.get("target_city"), "word_hint": original["word"]}


@api_router.get("/business/campaigns/{campaign_id}/report.csv")
async def campaign_report_csv(campaign_id: str, authorization: Optional[str] = Header(None)):
    """CSV export of regional breakdown — anunciantes precisam para PowerPoint/Excel."""
    user = await get_current_user(authorization)
    c = await db.campaigns.find_one({"campaign_id": campaign_id, "user_id": user["user_id"]}, {"_id": 0})
    if not c or not c.get("post_id"):
        raise HTTPException(status_code=404, detail="Campanha sem dados")
    post_id = c["post_id"]

    pipeline = [
        {"$match": {"post_id": post_id, "geo.country": {"$ne": None}}},
        {"$group": {"_id": {"country": "$geo.country", "region": "$geo.region", "city": "$geo.city"},
                    "aprovo": {"$sum": {"$cond": [{"$eq": ["$vote", "aprovo"]}, 1, 0]}},
                    "desaprovo": {"$sum": {"$cond": [{"$eq": ["$vote", "desaprovo"]}, 1, 0]}},
                    "total": {"$sum": 1}}},
        {"$sort": {"total": -1}},
    ]
    rows = await db.votes.aggregate(pipeline).to_list(length=1000)

    lines = ["country,region,city,aprovo,desaprovo,total,aprovo_pct"]
    for r in rows:
        k = r["_id"] or {}
        pct = round(r["aprovo"] / r["total"] * 100) if r["total"] else 0
        country = (k.get("country") or "").replace(",", " ")
        region = (k.get("region") or "").replace(",", " ")
        city = (k.get("city") or "").replace(",", " ")
        lines.append(f"{country},{region},{city},{r['aprovo']},{r['desaprovo']},{r['total']},{pct}")

    csv = "\n".join(lines)
    from fastapi.responses import Response
    return Response(content=csv, media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename=besord_{campaign_id}.csv"})


# ---------- Misc ----------
@api_router.get("/geo/me")
async def my_geo(request: Request):
    ip = get_client_ip(dict(request.headers))
    geo = await geo_lookup(ip)
    return {**geo, "ip": ip}


@api_router.get("/")
async def root():
    return {"message": "Besord API", "status": "ok", "version": "2.0"}


# ---------- Promo validation (public) ----------
class PromoValidateRequest(BaseModel):
    code: str
    tier_key: str

@api_router.post("/promos/validate")
async def validate_promo(payload: PromoValidateRequest):
    code = payload.code.strip().upper()
    promo = await db.promo_codes.find_one({"code": code, "active": {"$ne": False}}, {"_id": 0})
    if not promo:
        raise HTTPException(status_code=404, detail="Código inválido")
    now = datetime.now(timezone.utc)
    if promo.get("expires_at"):
        exp = promo["expires_at"]
        if isinstance(exp, datetime):
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < now:
                raise HTTPException(status_code=400, detail="Código expirado")
    if promo.get("max_uses") and promo.get("uses", 0) >= promo["max_uses"]:
        raise HTTPException(status_code=400, detail="Código esgotado")
    if payload.tier_key not in TIERS:
        raise HTTPException(status_code=400, detail="Plano inválido")
    tier = TIERS[payload.tier_key]
    discount_pct = int(promo["discount_pct"])
    final = int(round(tier.amount_cents * (100 - discount_pct) / 100))
    return {"valid": True, "code": code, "discount_pct": discount_pct, "original_cents": tier.amount_cents, "final_cents": final}


# ---------- Admin (owner only) ----------
async def require_admin(authorization: Optional[str] = Header(None)) -> dict:
    user = await get_current_user(authorization)
    if not ADMIN_EMAIL or user["email"].lower() != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return user


@api_router.get("/admin/overview")
async def admin_overview(authorization: Optional[str] = Header(None)):
    await require_admin(authorization)
    users_total = await db.users.count_documents({})
    businesses_total = await db.users.count_documents({"business_profile": {"$exists": True}})
    posts_total = await db.posts.count_documents({"hidden": {"$ne": True}})
    votes_total = await db.votes.count_documents({})
    campaigns_total = await db.campaigns.count_documents({})
    active_campaigns = await db.campaigns.count_documents({"status": "active"})
    paid_campaigns = await db.campaigns.count_documents({"status": {"$in": ["active", "completed"]}})

    # Revenue
    rev_agg = await db.campaigns.aggregate([
        {"$match": {"status": {"$in": ["active", "completed"]}}},
        {"$group": {"_id": None, "total_cents": {"$sum": "$amount_cents"}}},
    ]).to_list(length=1)
    total_revenue_cents = int(rev_agg[0]["total_cents"]) if rev_agg else 0

    # Top words
    top_words = await db.posts.aggregate([
        {"$match": {"hidden": {"$ne": True}}},
        {"$group": {"_id": "$word", "count": {"$sum": 1}, "engagement": {"$sum": {"$add": ["$aprovo_count", "$desaprovo_count"]}}}},
        {"$sort": {"engagement": -1}}, {"$limit": 10},
    ]).to_list(length=10)

    return {
        "users_total": users_total,
        "businesses_total": businesses_total,
        "posts_total": posts_total,
        "votes_total": votes_total,
        "comments_total": await db.comments.count_documents({}),
        "campaigns_total": campaigns_total,
        "active_campaigns": active_campaigns,
        "paid_campaigns": paid_campaigns,
        "total_revenue_cents": total_revenue_cents,
        "total_revenue_usd": total_revenue_cents / 100,
        "stripe_mode": "LIVE" if stripe.api_key.startswith("sk_live_") else ("TEST" if stripe.api_key.startswith("sk_test_") and stripe.api_key != "sk_test_emergent" else "MOCK"),
        "top_words": [{"word": w["_id"], "posts": w["count"], "engagement": w["engagement"]} for w in top_words],
    }


@api_router.get("/admin/advertisers")
async def admin_advertisers(authorization: Optional[str] = Header(None)):
    await require_admin(authorization)
    cursor = db.users.find({"business_profile": {"$exists": True}}, {"_id": 0, "user_id": 1, "email": 1, "name": 1, "business_profile": 1, "created_at": 1})
    advertisers = await cursor.to_list(length=500)
    out = []
    for a in advertisers:
        camp_count = await db.campaigns.count_documents({"user_id": a["user_id"]})
        paid = await db.campaigns.aggregate([
            {"$match": {"user_id": a["user_id"], "status": {"$in": ["active", "completed"]}}},
            {"$group": {"_id": None, "spent": {"$sum": "$amount_cents"}}},
        ]).to_list(length=1)
        out.append({
            "user_id": a["user_id"], "email": a["email"], "name": a["name"],
            "company_name": a["business_profile"].get("company_name"),
            "country": a["business_profile"].get("country"),
            "tax_id": a["business_profile"].get("tax_id"),
            "campaigns": camp_count,
            "spent_cents": int(paid[0]["spent"]) if paid else 0,
        })
    return out


@api_router.get("/admin/campaigns")
async def admin_campaigns(authorization: Optional[str] = Header(None)):
    await require_admin(authorization)
    cursor = db.campaigns.find({}, {"_id": 0, "image_base64": 0}).sort("created_at", -1).limit(200)
    docs = await cursor.to_list(length=200)
    for c in docs:
        if isinstance(c.get("created_at"), datetime):
            c["created_at"] = c["created_at"].isoformat()
        if isinstance(c.get("starts_at"), datetime):
            c["starts_at"] = c["starts_at"].isoformat()
        if isinstance(c.get("ends_at"), datetime):
            c["ends_at"] = c["ends_at"].isoformat()
    return docs


class TierUpdate(BaseModel):
    tier_key: str
    amount_cents: int
    included_votes: int


@api_router.get("/admin/campaigns/{campaign_id}/audit")
async def admin_campaign_audit(campaign_id: str, authorization: Optional[str] = Header(None)):
    """Return the immutable audit trail for a campaign (creation only — words are never updated)."""
    await require_admin(authorization)
    rows = await db.campaign_audit.find({"campaign_id": campaign_id}, {"_id": 0}).sort("created_at", 1).to_list(length=100)
    for r in rows:
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
    camp = await db.campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0, "word": 1, "user_id": 1, "status": 1})
    return {"campaign_id": campaign_id, "current": camp, "audit_trail": rows}


@api_router.get("/admin/tiers")
async def admin_list_tiers(authorization: Optional[str] = Header(None)):
    """Return tier defaults merged with any DB overrides — for the admin editor."""
    await require_admin(authorization)
    await apply_tier_overrides()
    overrides = await db.tier_overrides.find({}, {"_id": 0}).to_list(length=100)
    overrides_map = {o["tier_key"]: o for o in overrides}
    out = []
    for t in TIERS.values():
        ov = overrides_map.get(t.key)
        out.append({
            "key": t.key,
            "name": t.name,
            "scope": t.scope,
            "duration_days": t.duration_days,
            "amount_cents": t.amount_cents,
            "included_votes": t.included_votes,
            "is_overridden": bool(ov),
            "overridden_at": (ov.get("updated_at").isoformat() if ov and ov.get("updated_at") else None),
        })
    return out


@api_router.post("/admin/tiers")
async def admin_update_tier(payload: TierUpdate, authorization: Optional[str] = Header(None)):
    admin_user = await require_admin(authorization)
    if payload.tier_key not in TIERS:
        raise HTTPException(status_code=400, detail="Tier desconhecido")
    if payload.amount_cents < 100:
        raise HTTPException(status_code=400, detail="Preço mínimo: 1,00 EUR (100 cêntimos)")
    if payload.amount_cents > 10_000_00:
        raise HTTPException(status_code=400, detail="Preço máximo: 10.000 EUR")
    if payload.included_votes < 10 or payload.included_votes > 1_000_000:
        raise HTTPException(status_code=400, detail="Votos incluídos entre 10 e 1.000.000")
    now = datetime.now(timezone.utc)
    # Persist override in DB; apply_tier_overrides() reads from DB at runtime
    await db.tier_overrides.update_one(
        {"tier_key": payload.tier_key},
        {"$set": {
            "tier_key": payload.tier_key,
            "amount_cents": payload.amount_cents,
            "included_votes": payload.included_votes,
            "updated_at": now,
            "updated_by": admin_user["user_id"],
            "updated_by_email": admin_user["email"],
        }},
        upsert=True,
    )
    await db.admin_audit.insert_one({
        "event": "tier_price_update",
        "tier_key": payload.tier_key,
        "amount_cents": payload.amount_cents,
        "included_votes": payload.included_votes,
        "actor_user_id": admin_user["user_id"],
        "actor_email": admin_user["email"],
        "created_at": now,
    })
    await apply_tier_overrides()
    return {"ok": True, "tier_key": payload.tier_key,
            "amount_cents": payload.amount_cents,
            "included_votes": payload.included_votes}


@api_router.delete("/admin/tiers/{tier_key}")
async def admin_reset_tier(tier_key: str, authorization: Optional[str] = Header(None)):
    """Reset a tier to default values (deletes the override row)."""
    admin_user = await require_admin(authorization)
    if tier_key not in TIERS:
        raise HTTPException(status_code=404, detail="Tier não encontrado")
    await db.tier_overrides.delete_one({"tier_key": tier_key})
    await db.admin_audit.insert_one({
        "event": "tier_price_reset",
        "tier_key": tier_key,
        "actor_user_id": admin_user["user_id"],
        "actor_email": admin_user["email"],
        "created_at": datetime.now(timezone.utc),
    })
    from pricing import TIERS as DEFAULTS
    if tier_key in DEFAULTS:
        TIERS[tier_key].amount_cents = DEFAULTS[tier_key].amount_cents
        TIERS[tier_key].included_votes = DEFAULTS[tier_key].included_votes
    return {"ok": True, "tier_key": tier_key}


class PromoCreate(BaseModel):
    code: str
    discount_pct: int  # 1-100
    max_uses: Optional[int] = None
    expires_at: Optional[str] = None  # ISO

@api_router.get("/admin/promos")
async def admin_list_promos(authorization: Optional[str] = Header(None)):
    await require_admin(authorization)
    docs = await db.promo_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    for d in docs:
        if isinstance(d.get("created_at"), datetime):
            d["created_at"] = d["created_at"].isoformat()
        if isinstance(d.get("expires_at"), datetime):
            d["expires_at"] = d["expires_at"].isoformat()
    return docs

@api_router.post("/admin/promos")
async def admin_create_promo(payload: PromoCreate, authorization: Optional[str] = Header(None)):
    await require_admin(authorization)
    code = payload.code.strip().upper()
    if not code or payload.discount_pct < 1 or payload.discount_pct > 100:
        raise HTTPException(status_code=400, detail="Dados inválidos")
    expires = None
    if payload.expires_at:
        try:
            expires = datetime.fromisoformat(payload.expires_at.replace("Z", "+00:00"))
        except Exception:
            pass
    doc = {
        "code": code,
        "discount_pct": payload.discount_pct,
        "max_uses": payload.max_uses,
        "uses": 0,
        "expires_at": expires,
        "created_at": datetime.now(timezone.utc),
        "active": True,
    }
    await db.promo_codes.update_one({"code": code}, {"$set": doc}, upsert=True)
    return {"ok": True, "code": code}

@api_router.delete("/admin/promos/{code}")
async def admin_delete_promo(code: str, authorization: Optional[str] = Header(None)):
    await require_admin(authorization)
    await db.promo_codes.delete_one({"code": code.upper()})
    return {"ok": True}


@api_router.post("/admin/campaigns/{campaign_id}/cancel")
async def admin_cancel_campaign(campaign_id: str, authorization: Optional[str] = Header(None)):
    await require_admin(authorization)
    await db.campaigns.update_one({"campaign_id": campaign_id}, {"$set": {"status": "canceled"}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Admin moderation queue
# ---------------------------------------------------------------------------

@api_router.get("/admin/moderation/queue")
async def admin_moderation_queue(authorization: Optional[str] = Header(None),
                                  status: str = Query("pending", regex="^(pending|hidden|all)$"),
                                  limit: int = Query(50, ge=1, le=200)):
    """List posts that have been reported. status=pending (>=1 report, not yet hidden),
    hidden (already auto-hidden), all."""
    await require_admin(authorization)
    query: dict = {}
    if status == "pending":
        query = {"reports_count": {"$gte": 1}, "$or": [{"hidden": {"$exists": False}}, {"hidden": False}]}
    elif status == "hidden":
        query = {"hidden": True}
    else:
        query = {"reports_count": {"$gte": 1}}
    docs = await db.posts.find(query, {"_id": 0, "image_base64": 0}).sort("reports_count", -1).limit(limit).to_list(length=limit)
    for d in docs:
        if isinstance(d.get("created_at"), datetime):
            d["created_at"] = d["created_at"].isoformat()
    return {"items": docs, "count": len(docs)}


class ModerationAction(BaseModel):
    action: str  # "hide" | "restore" | "delete"


@api_router.post("/admin/moderation/post/{post_id}")
async def admin_moderation_action(post_id: str, payload: ModerationAction,
                                   authorization: Optional[str] = Header(None)):
    admin_user = await require_admin(authorization)
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    if payload.action == "hide":
        await db.posts.update_one({"post_id": post_id}, {"$set": {"hidden": True, "hidden_at": datetime.now(timezone.utc), "hidden_by": admin_user["user_id"]}})
    elif payload.action == "restore":
        await db.posts.update_one({"post_id": post_id}, {"$set": {"hidden": False, "reports_count": 0}, "$unset": {"hidden_at": "", "hidden_by": ""}})
    elif payload.action == "delete":
        await db.posts.delete_one({"post_id": post_id})
        await db.comments.delete_many({"post_id": post_id})
        await db.votes.delete_many({"post_id": post_id})
    else:
        raise HTTPException(status_code=400, detail="Ação inválida")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Stripe webhook (signature-verified, idempotent reconciliation)
# ---------------------------------------------------------------------------

@app.post("/api/stripe/webhook")
async def stripe_webhook(request: Request):
    """Receive Stripe events and reconcile campaign state.

    Security:
    - Requires `Stripe-Signature` header verified against STRIPE_WEBHOOK_SECRET.
    - If the secret is not set we 503 — never trust unsigned webhooks in prod.
    - Idempotent via `stripe_webhook_events` collection (event id de-dup).
    """
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Stripe webhook not configured")
    payload_bytes = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(
            payload_bytes, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError as e:
        logger.warning(f"Stripe webhook bad signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        logger.error(f"Stripe webhook parse error: {e}")
        raise HTTPException(status_code=400, detail="Bad payload")

    event_id = event.get("id")
    if event_id:
        existing = await db.stripe_webhook_events.find_one({"event_id": event_id})
        if existing:
            return {"received": True, "duplicate": True}
        await db.stripe_webhook_events.insert_one({
            "event_id": event_id,
            "type": event.get("type"),
            "received_at": datetime.now(timezone.utc),
        })

    etype = event.get("type")
    data_obj = event.get("data", {}).get("object", {}) or {}

    if etype == "checkout.session.completed":
        campaign_id = (data_obj.get("metadata") or {}).get("campaign_id")
        session_payment_status = data_obj.get("payment_status")
        if campaign_id and session_payment_status == "paid":
            now = datetime.now(timezone.utc)
            camp = await db.campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
            if camp and camp.get("status") != "active":
                ends_at = now + timedelta(days=int(camp.get("duration_days") or 0))
                await db.campaigns.update_one(
                    {"campaign_id": campaign_id},
                    {"$set": {"status": "active", "starts_at": now, "ends_at": ends_at,
                              "stripe_session_id": data_obj.get("id"),
                              "paid_at": now}},
                )
                logger.info(f"Stripe webhook activated campaign {campaign_id}")

    elif etype in ("charge.refunded", "checkout.session.expired"):
        campaign_id = (data_obj.get("metadata") or {}).get("campaign_id")
        if campaign_id:
            await db.campaigns.update_one(
                {"campaign_id": campaign_id},
                {"$set": {"status": "canceled", "canceled_at": datetime.now(timezone.utc),
                          "cancel_reason": etype}},
            )
            logger.info(f"Stripe webhook canceled campaign {campaign_id} ({etype})")

    return {"received": True}


app.include_router(api_router)


# ---------------------------------------------------------------------------
# Static download — Besord public website (besord.eu) packaged as ZIP.
# Exposed under /api/* so it goes through the same ingress as the rest of the
# backend. Not gated — the zip contains only public content (legal pages + landing).
# ---------------------------------------------------------------------------

from fastapi.responses import FileResponse, Response
from pathlib import Path

_WEBSITE_ZIP_PATH = Path(__file__).parent / "static" / "besord-site.zip"


@app.get("/api/download/besord-site.zip")
async def download_besord_site_zip():
    if not _WEBSITE_ZIP_PATH.exists():
        return Response("Zip not found", status_code=404)
    return FileResponse(
        path=str(_WEBSITE_ZIP_PATH),
        media_type="application/zip",
        filename="besord-site.zip",
    )

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def setup_indexes():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.users.create_index("apple_id", sparse=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("user_id")
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.posts.create_index("post_id", unique=True)
        await db.posts.create_index([("created_at", -1)])
        await db.posts.create_index("word")
        await db.posts.create_index("is_sponsored")
        await db.posts.create_index("campaign_id", sparse=True)
        await db.votes.create_index([("post_id", 1), ("user_id", 1)], unique=True)
        await db.comments.create_index("comment_id", unique=True)
        await db.comments.create_index([("post_id", 1), ("user_id", 1)], unique=True)
        await db.reports.create_index([("post_id", 1), ("user_id", 1)], unique=True)
        await db.campaigns.create_index("campaign_id", unique=True)
        await db.campaigns.create_index("user_id")
        await db.campaigns.create_index("status")
    except Exception as e:
        logger.warning(f"Index setup warning: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
