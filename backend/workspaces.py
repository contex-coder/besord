"""
Workspaces module for Besord.

A single user (one login) can own:
- exactly ONE `personal` workspace (auto-created on first /me hit; uses BW for ads)
- zero or more `business` workspaces (PJ with own NIF/billing email; uses Stripe)

The workspace_id is what scopes B2B campaigns going forward. Existing campaigns
keep their `user_id` reference; new ones also store `workspace_id` so dashboards
can filter by business identity rather than by login identity.
"""
import secrets
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, Field, EmailStr

logger = logging.getLogger(__name__)


# ---------- Models ----------
class WorkspaceCreate(BaseModel):
    type: str = Field(..., pattern="^(personal|business)$")
    name: str = Field(min_length=1, max_length=100)
    nif: Optional[str] = Field(default=None, max_length=30)
    billing_email: Optional[EmailStr] = None
    country_code: Optional[str] = Field(default=None, max_length=2)
    picture: Optional[str] = None  # base64 logo, optional


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    nif: Optional[str] = Field(default=None, max_length=30)
    billing_email: Optional[EmailStr] = None
    country_code: Optional[str] = Field(default=None, max_length=2)
    picture: Optional[str] = None


class WorkspaceOut(BaseModel):
    workspace_id: str
    owner_user_id: str
    type: str  # personal | business
    name: str
    nif: Optional[str] = None
    billing_email: Optional[str] = None
    country_code: Optional[str] = None
    picture: Optional[str] = None
    created_at: str
    is_default: bool = False


# ---------- Helpers ----------
def _now():
    return datetime.now(timezone.utc)


def _ws_id(prefix: str = "ws") -> str:
    return f"{prefix}_{secrets.token_hex(8)}"


def _serialize(doc: dict, default_id: Optional[str] = None) -> WorkspaceOut:
    return WorkspaceOut(
        workspace_id=doc["workspace_id"],
        owner_user_id=doc["owner_user_id"],
        type=doc["type"],
        name=doc.get("name") or "",
        nif=doc.get("nif"),
        billing_email=doc.get("billing_email"),
        country_code=doc.get("country_code"),
        picture=doc.get("picture"),
        created_at=(doc.get("created_at") or _now()).isoformat()
        if not isinstance(doc.get("created_at"), str)
        else doc.get("created_at"),
        is_default=(default_id is not None and doc["workspace_id"] == default_id),
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
    doc = {
        "workspace_id": _ws_id("ws"),
        "owner_user_id": user["user_id"],
        "type": "business",
        "name": bp.get("company_name") or "Minha Empresa",
        "nif": bp.get("nif"),
        "billing_email": bp.get("billing_email") or user.get("email"),
        "country_code": (bp.get("country_code") or "").upper() or None,
        "picture": bp.get("logo") or user.get("picture"),
        "created_at": _now(),
        "migrated_from_business_profile": True,
    }
    await db.workspaces.insert_one(doc)
    return doc


async def ensure_indexes(db) -> None:
    try:
        await db.workspaces.create_index("workspace_id", unique=True)
        await db.workspaces.create_index([("owner_user_id", 1), ("type", 1)])
    except Exception as e:
        logger.warning("workspaces ensure_indexes warning: %s", e)


# ---------- Router ----------
def build_router(db, get_current_user) -> APIRouter:
    router = APIRouter()

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
            if not payload.nif:
                raise HTTPException(400, "NIF obrigatório para empresa.")
            if not payload.billing_email:
                raise HTTPException(400, "Email de faturação obrigatório para empresa.")

        doc = {
            "workspace_id": _ws_id("ws"),
            "owner_user_id": user["user_id"],
            "type": payload.type,
            "name": payload.name.strip(),
            "nif": (payload.nif or "").strip() or None,
            "billing_email": payload.billing_email,
            "country_code": (payload.country_code or "").upper() or None,
            "picture": payload.picture,
            "created_at": _now(),
        }
        await db.workspaces.insert_one(doc)
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
        if "country_code" in update and update["country_code"]:
            update["country_code"] = update["country_code"].upper()
        if update:
            update["updated_at"] = _now()
            await db.workspaces.update_one({"_id": ws["_id"]}, {"$set": update})
            ws.update(update)
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

    return router
