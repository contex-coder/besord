"""
Password-based authentication module for Besord.

Coexists with Emergent Google/Apple OAuth. Uses the same `user_sessions`
collection and Bearer token mechanism so `/api/auth/me` keeps working
uniformly regardless of how the user logged in.
"""
import os
import re
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel, EmailStr, Field
from passlib.context import CryptContext

logger = logging.getLogger(__name__)

# ----- Hashing -----
# bcrypt has a 72-byte input limit; passlib raises if the password is longer.
# We pre-truncate to be safe (also enforced via Pydantic max_length).
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain[:72])


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain[:72], hashed)
    except Exception:
        return False


# ----- Config -----
SESSION_TTL_DAYS = int(os.getenv("SESSION_TTL_DAYS", "30"))
RESET_TOKEN_TTL_MIN = int(os.getenv("RESET_TOKEN_TTL_MINUTES", "60"))
MAX_LOGIN_ATTEMPTS = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
LOGIN_WINDOW_MIN = int(os.getenv("LOGIN_WINDOW_MINUTES", "15"))

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ----- Pydantic models -----
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    name: Optional[str] = Field(default=None, max_length=80)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    user_id: str
    token: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=72)


class PasswordAuthResponse(BaseModel):
    token: str
    user_id: str
    email: EmailStr
    name: Optional[str] = None


# ----- Helpers -----
def _now() -> datetime:
    return datetime.now(timezone.utc)


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "0.0.0.0"


def _normalize_email(raw: str) -> str:
    return (raw or "").strip().lower()


# ----- Rate-limit (per email + ip, MongoDB-backed) -----
async def _check_rate_limit(db, email: str, ip: str) -> None:
    rec = await db.login_attempts.find_one({"email": email, "ip": ip})
    if not rec:
        return
    expires_at = rec.get("expires_at")
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at > _now() and rec.get("count", 0) >= MAX_LOGIN_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Muitas tentativas de login. Tenta novamente em alguns minutos.",
        )


async def _register_failed_attempt(db, email: str, ip: str) -> None:
    now = _now()
    window_end = now + timedelta(minutes=LOGIN_WINDOW_MIN)
    await db.login_attempts.update_one(
        {"email": email, "ip": ip},
        {
            "$inc": {"count": 1},
            "$set": {"expires_at": window_end, "updated_at": now},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )


async def _clear_attempts(db, email: str, ip: str) -> None:
    await db.login_attempts.delete_one({"email": email, "ip": ip})


# ----- Session helpers -----
async def _create_session(db, user_id: str, provider: str = "password") -> str:
    token = f"pwd_{secrets.token_urlsafe(32)}"
    now = _now()
    expires_at = now + timedelta(days=SESSION_TTL_DAYS)
    await db.user_sessions.insert_one(
        {
            "session_token": token,
            "user_id": user_id,
            "auth_provider": provider,
            "created_at": now,
            "expires_at": expires_at,
        }
    )
    return token


# ----- Indexes (called from server.py at startup) -----
async def ensure_indexes(db) -> None:
    try:
        await db.users.create_index("email", unique=False)  # not strictly unique (legacy data)
        await db.login_attempts.create_index([("email", 1), ("ip", 1)], unique=True)
        await db.login_attempts.create_index("expires_at", expireAfterSeconds=0)
        await db.password_reset_tokens.create_index("user_id")
        await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    except Exception as e:
        logger.warning("password_auth ensure_indexes warning: %s", e)


# ----- Router -----
def build_router(db, user_out_fn) -> APIRouter:
    """
    Build an APIRouter wired against the provided MongoDB and the existing
    `user_out` serializer used in server.py.
    """
    router = APIRouter()

    @router.post("/auth/register", response_model=PasswordAuthResponse)
    async def register(payload: RegisterRequest):
        email = _normalize_email(payload.email)
        if not EMAIL_RE.match(email):
            raise HTTPException(status_code=400, detail="Email inválido.")
        now = _now()

        existing = await db.users.find_one({"email": email})
        if existing:
            if existing.get("password_hash"):
                raise HTTPException(
                    status_code=400,
                    detail="Já existe uma conta com este email. Faz login ou recupera a palavra-passe.",
                )
            # Attach password to an existing OAuth-only user
            await db.users.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "password_hash": hash_password(payload.password),
                        "updated_at": now,
                        **({"name": payload.name} if (payload.name and not existing.get("name")) else {}),
                    },
                    "$addToSet": {"auth_providers": "password"},
                },
            )
            user_id = existing["user_id"]
            name = existing.get("name") or payload.name
        else:
            user_id = f"user_{secrets.token_hex(8)}"
            await db.users.insert_one(
                {
                    "user_id": user_id,
                    "email": email,
                    "name": payload.name or email.split("@")[0],
                    "picture": None,
                    "password_hash": hash_password(payload.password),
                    "is_admin": False,
                    "business_profile": None,
                    "bw_balance": 0,
                    "bw_total_earned": 0,
                    "followed_styles": [],
                    "auth_providers": ["password"],
                    "created_at": now,
                    "updated_at": now,
                }
            )
            name = payload.name or email.split("@")[0]

        token = await _create_session(db, user_id, provider="password")
        return PasswordAuthResponse(token=token, user_id=user_id, email=email, name=name)

    @router.post("/auth/login", response_model=PasswordAuthResponse)
    async def login(payload: LoginRequest, request: Request):
        email = _normalize_email(payload.email)
        ip = _client_ip(request)
        await _check_rate_limit(db, email, ip)

        user = await db.users.find_one({"email": email})
        if not user or not user.get("password_hash"):
            await _register_failed_attempt(db, email, ip)
            raise HTTPException(status_code=400, detail="Email ou palavra-passe inválidos.")

        if not verify_password(payload.password, user["password_hash"]):
            await _register_failed_attempt(db, email, ip)
            raise HTTPException(status_code=400, detail="Email ou palavra-passe inválidos.")

        await _clear_attempts(db, email, ip)
        token = await _create_session(db, user["user_id"], provider="password")
        return PasswordAuthResponse(
            token=token,
            user_id=user["user_id"],
            email=email,
            name=user.get("name"),
        )

    @router.post("/auth/forgot-password")
    async def forgot_password(payload: ForgotPasswordRequest):
        email = _normalize_email(payload.email)
        user = await db.users.find_one({"email": email})
        if user:
            # Generate single-use token, store only its hash
            plain = secrets.token_urlsafe(32)
            now = _now()
            await db.password_reset_tokens.delete_many({"user_id": user["user_id"]})
            await db.password_reset_tokens.insert_one(
                {
                    "user_id": user["user_id"],
                    "token_hash": hash_password(plain),
                    "expires_at": now + timedelta(minutes=RESET_TOKEN_TTL_MIN),
                    "created_at": now,
                }
            )
            # Resend DNS is pending; we log the reset link for now.
            # When Resend is live, swap this for an actual email dispatch.
            frontend_base = os.getenv("FRONTEND_BASE_URL", "https://besord.eu")
            reset_link = f"{frontend_base}/reset-password?userId={user['user_id']}&token={plain}"
            logger.info("[password-reset] %s -> %s", email, reset_link)
        # Generic response to avoid email enumeration
        return {"ok": True, "message": "Se este email existir, enviámos instruções para recuperar a palavra-passe."}

    @router.post("/auth/reset-password")
    async def reset_password(payload: ResetPasswordRequest):
        rec = await db.password_reset_tokens.find_one({"user_id": payload.user_id})
        now = _now()
        if not rec:
            raise HTTPException(status_code=400, detail="Token inválido ou expirado.")
        expires_at = rec.get("expires_at")
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at and expires_at < now:
            await db.password_reset_tokens.delete_many({"user_id": payload.user_id})
            raise HTTPException(status_code=400, detail="Token inválido ou expirado.")
        if not verify_password(payload.token, rec["token_hash"]):
            raise HTTPException(status_code=400, detail="Token inválido ou expirado.")

        result = await db.users.update_one(
            {"user_id": payload.user_id},
            {"$set": {"password_hash": hash_password(payload.new_password), "updated_at": now}},
        )
        await db.password_reset_tokens.delete_many({"user_id": payload.user_id})
        if result.matched_count == 0:
            raise HTTPException(status_code=400, detail="Token inválido ou expirado.")
        # Invalidate all existing sessions for security
        await db.user_sessions.delete_many({"user_id": payload.user_id})
        return {"ok": True, "message": "Palavra-passe atualizada com sucesso."}

    return router
