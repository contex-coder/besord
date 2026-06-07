"""
Workspaces module for Besord.

A single user (one login) can own:
- exactly ONE `personal` workspace (auto-created on first /me hit; uses BW for ads)
- zero or more `business` workspaces (PJ with own NIF/billing email; uses Stripe)

The workspace_id is what scopes B2B campaigns going forward. Existing campaigns
keep their `user_id` reference; new ones also store `workspace_id` so dashboards
can filter by business identity rather than by login identity.
"""
import os
import secrets
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, Field, EmailStr

import secrets as _secrets
from email_alerts import send_verification_email
from tax_validation import validate_tax_id
from passlib.context import CryptContext

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

logger = logging.getLogger(__name__)


# ---------- Country → Tax ID metadata ----------
# Single source of truth for which fiscal field a country uses.
COUNTRY_TAX_META = {
    "BR": {"name": "Brasil",          "tax_label": "CNPJ"},
    "US": {"name": "United States",   "tax_label": "EIN"},
    "GB": {"name": "United Kingdom",  "tax_label": "VAT"},
    "PT": {"name": "Portugal",        "tax_label": "NIPC"},
    "DE": {"name": "Germany",         "tax_label": "USt-IdNr"},
    "FR": {"name": "France",          "tax_label": "SIRET"},
    "ES": {"name": "España",          "tax_label": "CIF"},
    "IT": {"name": "Italia",          "tax_label": "P.IVA"},
    "CA": {"name": "Canada",          "tax_label": "BN"},
    "MX": {"name": "México",          "tax_label": "RFC"},
    "AR": {"name": "Argentina",       "tax_label": "CUIT"},
    "CN": {"name": "中国",             "tax_label": "USCC"},
    "JP": {"name": "日本",             "tax_label": "法人番号"},
    "OT": {"name": "Other / Outro",   "tax_label": "Tax ID"},
}


def tax_label_for(country_code: Optional[str]) -> str:
    cc = (country_code or "").upper()
    return (COUNTRY_TAX_META.get(cc) or COUNTRY_TAX_META["OT"])["tax_label"]


def country_name_for(country_code: Optional[str]) -> Optional[str]:
    cc = (country_code or "").upper()
    return (COUNTRY_TAX_META.get(cc) or {}).get("name")


# ---------- Models ----------
class WorkspaceCreate(BaseModel):
    type: str = Field(..., pattern="^(personal|business)$")
    name: str = Field(min_length=1, max_length=100)
    # Legacy field — accepted for back-compat (mapped to tax_id internally)
    nif: Optional[str] = Field(default=None, max_length=30)
    # New rich fiscal fields
    tax_id: Optional[str] = Field(default=None, max_length=30)
    tax_id_label: Optional[str] = Field(default=None, max_length=30)
    country_code: Optional[str] = Field(default=None, max_length=2)
    country_name: Optional[str] = Field(default=None, max_length=80)
    contact_name: Optional[str] = Field(default=None, max_length=80)
    contact_email: Optional[EmailStr] = None
    billing_email: Optional[EmailStr] = None
    picture: Optional[str] = None  # base64 logo


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    nif: Optional[str] = Field(default=None, max_length=30)
    tax_id: Optional[str] = Field(default=None, max_length=30)
    tax_id_label: Optional[str] = Field(default=None, max_length=30)
    country_code: Optional[str] = Field(default=None, max_length=2)
    country_name: Optional[str] = Field(default=None, max_length=80)
    contact_name: Optional[str] = Field(default=None, max_length=80)
    contact_email: Optional[EmailStr] = None
    billing_email: Optional[EmailStr] = None
    picture: Optional[str] = None


class WorkspaceOut(BaseModel):
    workspace_id: str
    owner_user_id: str
    type: str  # personal | business
    name: str
    # Tax fields (kept both for back-compat: nif==tax_id always)
    nif: Optional[str] = None
    tax_id: Optional[str] = None
    tax_id_label: Optional[str] = None
    # Country
    country_code: Optional[str] = None
    country_name: Optional[str] = None
    # Contact
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    billing_email: Optional[str] = None
    picture: Optional[str] = None
    created_at: str
    is_default: bool = False
    # Verification
    verified: bool = False
    verified_at: Optional[str] = None

class MemberOut(BaseModel):
    member_id: str
    workspace_id: str
    user_id: str
    user_name: str
    user_email: str
    role: str = "member"  # owner | admin | member
    status: str = "active"  # invited | active | declined
    created_at: str = ""

class InviteCreate(BaseModel):
    email: str = Field(..., description="Email do convidado")
    role: str = "member"

class MemberUpdate(BaseModel):
    role: str | None = None



# ---------- Helpers ----------
def _now():
    return datetime.now(timezone.utc)


def _ws_id(prefix: str = "ws") -> str:
    return f"{prefix}_{secrets.token_hex(8)}"


def _serialize(doc: dict, default_id: Optional[str] = None) -> WorkspaceOut:
    tax_id = doc.get("tax_id") or doc.get("nif")
    return WorkspaceOut(
        workspace_id=doc["workspace_id"],
        owner_user_id=doc["owner_user_id"],
        type=doc["type"],
        name=doc.get("name") or "",
        nif=tax_id,  # legacy alias
        tax_id=tax_id,
        tax_id_label=doc.get("tax_id_label") or tax_label_for(doc.get("country_code")),
        country_code=doc.get("country_code"),
        country_name=doc.get("country_name") or country_name_for(doc.get("country_code")),
        contact_name=doc.get("contact_name"),
        contact_email=doc.get("contact_email") or doc.get("billing_email"),
        billing_email=doc.get("billing_email") or doc.get("contact_email"),
        picture=doc.get("picture"),
        created_at=(doc.get("created_at") or _now()).isoformat()
        if not isinstance(doc.get("created_at"), str)
        else doc.get("created_at"),
        is_default=(default_id is not None and doc["workspace_id"] == default_id),
        verified=bool(doc.get("verified", False)),
        verified_at=(doc.get("verified_at").isoformat()
                     if isinstance(doc.get("verified_at"), datetime) else doc.get("verified_at")),
    )


async def ensure_personal_workspace(db, user: dict) -> dict:
    """Idempotent: ensure the user has exactly one personal workspace."""
    existing = await db.workspaces.find_one(
        {"owner_user_id": user["user_id"], "type": "personal", "deleted_at": {"$exists": False}}
    )
    if existing:
        return existing
    doc = {
        "workspace_id": _ws_id("ws"),
        "owner_user_id": user["user_id"],
        "type": "personal",
        "name": user.get("name") or (user.get("email") or "Pessoal").split("@")[0],
        "country_code": (user.get("country_code") or "").upper() or None,
        "billing_email": user.get("email"),
        "picture": user.get("picture"),
        "created_at": _now(),
    }
    await db.workspaces.insert_one(doc)
    return doc


async def ensure_business_workspace_from_profile(db, user: dict) -> Optional[dict]:
    """If the user has a legacy `business_profile` and no business workspace, migrate it."""
    bp = user.get("business_profile") or {}
    if not bp:
        return None
    existing = await db.workspaces.find_one(
        {"owner_user_id": user["user_id"], "type": "business", "deleted_at": {"$exists": False}}
    )
    if existing:
        return existing
    cc = (bp.get("country_code") or "").upper() or None
    doc = {
        "workspace_id": _ws_id("ws"),
        "owner_user_id": user["user_id"],
        "type": "business",
        "name": bp.get("company_name") or "Minha Empresa",
        "tax_id": bp.get("tax_id") or bp.get("nif"),
        "tax_id_label": tax_label_for(cc),
        "country_code": cc,
        "country_name": bp.get("country") or country_name_for(cc),
        "contact_name": bp.get("contact_name"),
        "contact_email": bp.get("contact_email") or user.get("email"),
        "billing_email": bp.get("billing_email") or bp.get("contact_email") or user.get("email"),
        "picture": bp.get("logo") or user.get("picture"),
        "created_at": _now(),
        "verified": True,  # legacy business_profile users grandfathered as verified
        "verified_at": _now(),
        "migrated_from_business_profile": True,
    }
    await db.workspaces.insert_one(doc)
    return doc


async def mirror_to_business_profile(db, ws: dict) -> None:
    """Workspaces is the source of truth — keep `users.business_profile` as a read-only mirror
    so legacy code (PDFs, emails, has_business gate) keeps working without changes."""
    if ws.get("type") != "business" or ws.get("deleted_at"):
        return
    profile = {
        "company_name": ws.get("name"),
        "country": ws.get("country_name") or country_name_for(ws.get("country_code")),
        "country_code": (ws.get("country_code") or "").upper() or None,
        "tax_id": ws.get("tax_id") or ws.get("nif"),
        "tax_id_label": ws.get("tax_id_label") or tax_label_for(ws.get("country_code")),
        "contact_email": ws.get("contact_email") or ws.get("billing_email"),
        "contact_name": ws.get("contact_name"),
        "billing_email": ws.get("billing_email") or ws.get("contact_email"),
        "active_workspace_id": ws["workspace_id"],
        "updated_at": _now(),
    }
    await db.users.update_one(
        {"user_id": ws["owner_user_id"]},
        {"$set": {"business_profile": profile}},
    )


async def ensure_indexes(db) -> None:
    try:
        await db.workspaces.create_index("workspace_id", unique=True)
        await db.workspaces.create_index([("owner_user_id", 1), ("type", 1)])
    except Exception as e:
        logger.warning("workspaces ensure_indexes warning: %s", e)


# ---------- Router ----------
def build_router(db, get_current_user) -> APIRouter:
    router = APIRouter()

    @router.get("/countries")
    async def list_countries():
        return {"countries": [
            {"code": code, "name": meta["name"], "tax_label": meta["tax_label"]}
            for code, meta in COUNTRY_TAX_META.items()
        ]}

    async def _list(user) -> List[dict]:
        # Idempotent migration on read
        await ensure_personal_workspace(db, user)
        await ensure_business_workspace_from_profile(db, user)
        rows = await db.workspaces.find(
            {"owner_user_id": user["user_id"], "deleted_at": {"$exists": False}},
            {"_id": 0},
        ).sort("created_at", 1).to_list(length=100)
        return rows

    @router.get("/workspaces")
    async def list_my_workspaces(authorization: Optional[str] = Header(None)):
        user = await get_current_user(authorization)
        rows = await _list(user)
        default_id = user.get("active_workspace_id")
        if not default_id and rows:
            # default to personal first, then first business
            personal = next((r for r in rows if r["type"] == "personal"), None)
            default_id = (personal or rows[0])["workspace_id"]
        return {"workspaces": [_serialize(r, default_id).model_dump() for r in rows],
                "active_workspace_id": default_id}

    @router.post("/workspaces", response_model=WorkspaceOut)
    async def create_workspace(payload: WorkspaceCreate,
                               authorization: Optional[str] = Header(None)):
        user = await get_current_user(authorization)
        if payload.type == "personal":
            # Only one personal per user; reject creating extra
            existing = await db.workspaces.find_one({
                "owner_user_id": user["user_id"], "type": "personal",
                "deleted_at": {"$exists": False},
            })
            if existing:
                raise HTTPException(409, "Já tens um workspace pessoal.")

        if payload.type == "business":
            raw_tax_id = (payload.tax_id or payload.nif or "").strip()
            if not raw_tax_id:
                raise HTTPException(400, "ID fiscal obrigatório para empresa.")
            ok, normalized = validate_tax_id(payload.country_code, raw_tax_id)
            if not ok:
                raise HTTPException(400, normalized)
            if not payload.billing_email and not payload.contact_email:
                raise HTTPException(400, "Email de faturação obrigatório para empresa.")

        cc = (payload.country_code or "").upper() or None
        # Generate email verification token (only for business workspaces)
        ver_token_plain = None
        ver_token_hash = None
        if payload.type == "business":
            ver_token_plain = _secrets.token_urlsafe(24)
            ver_token_hash = _pwd_ctx.hash(ver_token_plain)

        doc = {
            "workspace_id": _ws_id("ws"),
            "owner_user_id": user["user_id"],
            "type": payload.type,
            "name": payload.name.strip(),
            "tax_id": normalized if payload.type == "business" else None,
            "tax_id_label": payload.tax_id_label or tax_label_for(cc),
            "country_code": cc,
            "country_name": payload.country_name or country_name_for(cc),
            "contact_name": (payload.contact_name or "").strip() or None,
            "contact_email": payload.contact_email,
            "billing_email": payload.billing_email or payload.contact_email,
            "picture": payload.picture,
            "created_at": _now(),
            "verified": False,
            "verification_token_hash": ver_token_hash,
        }
        await db.workspaces.insert_one(doc)
        if doc["type"] == "business":
            await mirror_to_business_profile(db, doc)
            target = doc.get("billing_email") or doc.get("contact_email")
            front = os.getenv("FRONTEND_URL") or os.getenv("FRONTEND_BASE_URL", "https://besord.vercel.app")
            link = f"{front}/verify-empresa?ws={doc['workspace_id']}&token={ver_token_plain}"
            logger.info("[workspace-verify] %s → %s", target, link)
            send_verification_email(
                to_email=target,
                workspace_id=doc["workspace_id"],
                business_name=doc["name"],
                verification_token=ver_token_plain,
                front_base_url=front,
            )
        return _serialize(doc)

    @router.patch("/workspaces/{workspace_id}", response_model=WorkspaceOut)
    async def update_workspace(workspace_id: str, payload: WorkspaceUpdate,
                               authorization: Optional[str] = Header(None)):
        user = await get_current_user(authorization)
        ws = await db.workspaces.find_one({"workspace_id": workspace_id,
                                           "deleted_at": {"$exists": False}})
        if not ws or ws["owner_user_id"] != user["user_id"]:
            raise HTTPException(404, "Workspace não encontrado.")
        update = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
        # Normalize legacy alias nif → tax_id
        if "nif" in update and "tax_id" not in update:
            update["tax_id"] = update.pop("nif")
        elif "nif" in update:
            update.pop("nif")
        if "country_code" in update and update["country_code"]:
            update["country_code"] = update["country_code"].upper()
            # Auto-fill label/name from country if not provided
            update.setdefault("tax_id_label", tax_label_for(update["country_code"]))
            update.setdefault("country_name", country_name_for(update["country_code"]))
        if update:
            update["updated_at"] = _now()
            await db.workspaces.update_one({"_id": ws["_id"]}, {"$set": update})
            ws.update(update)
            if ws.get("type") == "business":
                await mirror_to_business_profile(db, ws)
        return _serialize(ws)

    @router.delete("/workspaces/{workspace_id}")
    async def delete_workspace(workspace_id: str,
                               authorization: Optional[str] = Header(None)):
        user = await get_current_user(authorization)
        ws = await db.workspaces.find_one({"workspace_id": workspace_id,
                                           "deleted_at": {"$exists": False}})
        if not ws or ws["owner_user_id"] != user["user_id"]:
            raise HTTPException(404, "Workspace não encontrado.")
        if ws["type"] == "personal":
            raise HTTPException(400, "Não podes apagar o workspace pessoal.")
        # Soft-delete; campaigns remain pointing to it for audit/history
        await db.workspaces.update_one(
            {"_id": ws["_id"]},
            {"$set": {"deleted_at": _now()}},
        )
        # If this was the active workspace, fallback to personal
        if user.get("active_workspace_id") == workspace_id:
            personal = await db.workspaces.find_one({
                "owner_user_id": user["user_id"], "type": "personal",
                "deleted_at": {"$exists": False},
            })
            if personal:
                await db.users.update_one(
                    {"user_id": user["user_id"]},
                    {"$set": {"active_workspace_id": personal["workspace_id"]}},
                )
        return {"ok": True}

    @router.post("/workspaces/{workspace_id}/activate")
    async def activate_workspace(workspace_id: str,
                                 authorization: Optional[str] = Header(None)):
        user = await get_current_user(authorization)
        ws = await db.workspaces.find_one({"workspace_id": workspace_id,
                                           "deleted_at": {"$exists": False}})
        if not ws or ws["owner_user_id"] != user["user_id"]:
            raise HTTPException(404, "Workspace não encontrado.")
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"active_workspace_id": workspace_id}},
        )
        return {"ok": True, "active_workspace_id": workspace_id}

    @router.post("/workspaces/{workspace_id}/verify-email/send")
    async def resend_verification(workspace_id: str,
                                   authorization: Optional[str] = Header(None)):
        user = await get_current_user(authorization)
        ws = await db.workspaces.find_one({"workspace_id": workspace_id,
                                           "deleted_at": {"$exists": False}})
        if not ws or ws["owner_user_id"] != user["user_id"]:
            raise HTTPException(404, "Workspace não encontrado.")
        if ws.get("type") != "business":
            raise HTTPException(400, "Apenas empresas precisam de verificação.")
        if ws.get("verified"):
            return {"ok": True, "already_verified": True}
        plain = _secrets.token_urlsafe(24)
        await db.workspaces.update_one(
            {"_id": ws["_id"]},
            {"$set": {"verification_token_hash": _pwd_ctx.hash(plain),
                       "verification_resent_at": _now()}},
        )
        target = ws.get("billing_email") or ws.get("contact_email")
        front = os.getenv("FRONTEND_URL") or os.getenv("FRONTEND_BASE_URL", "https://besord.vercel.app")
        link = f"{front}/verify-empresa?ws={workspace_id}&token={plain}"
        logger.info("[workspace-verify-resend] %s → %s", target, link)
        send_verification_email(
            to_email=target,
            workspace_id=workspace_id,
            business_name=ws.get("name") or "a tua empresa",
            verification_token=plain,
            front_base_url=front,
        )
        return {"ok": True, "message": "Email de verificação reenviado.", "sent_to": target}

    @router.post("/workspaces/{workspace_id}/verify-email/confirm")
    async def confirm_verification(workspace_id: str, payload: dict,
                                    authorization: Optional[str] = Header(None)):
        user = await get_current_user(authorization)
        ws = await db.workspaces.find_one({"workspace_id": workspace_id,
                                           "deleted_at": {"$exists": False}})
        if not ws or ws["owner_user_id"] != user["user_id"]:
            raise HTTPException(404, "Workspace não encontrado.")
        if ws.get("verified"):
            return {"ok": True, "already_verified": True}
        token = (payload or {}).get("token") or ""
        h = ws.get("verification_token_hash")
        if not h or not _pwd_ctx.verify(token, h):
            raise HTTPException(400, "Token inválido ou expirado.")
        now = _now()
        await db.workspaces.update_one(
            {"_id": ws["_id"]},
            {"$set": {"verified": True, "verified_at": now},
             "$unset": {"verification_token_hash": ""}},
        )
        ws["verified"] = True
        ws["verified_at"] = now
        if ws.get("type") == "business":
            await mirror_to_business_profile(db, ws)
        return {"ok": True, "verified": True}

    return router
