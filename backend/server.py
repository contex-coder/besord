from fastapi import FastAPI, APIRouter, HTTPException, Request, Header
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
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------- Models ----------
class SessionRequest(BaseModel):
    session_id: str

class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None

class AuthResponse(BaseModel):
    token: str
    user: UserOut

class PostCreate(BaseModel):
    word: str
    image_base64: str  # data URI or raw base64

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
    user_vote: Optional[Literal["aprovo", "desaprovo"]] = None

class VoteRequest(BaseModel):
    vote: Literal["aprovo", "desaprovo"]


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


# ---------- Auth Routes ----------
@api_router.post("/auth/session", response_model=AuthResponse)
async def auth_session(payload: SessionRequest):
    """Exchange session_id from Emergent auth for our backend session."""
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
    email = data.get("email")
    name = data.get("name", email)
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=400, detail="Resposta de auth inválida")

    # Upsert user
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(user.copy())
    else:
        # Refresh name/picture
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"name": name, "picture": picture}},
        )
        user["name"] = name
        user["picture"] = picture

    # Store session (replace any prior with same token)
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {
            "$set": {
                "session_token": session_token,
                "user_id": user["user_id"],
                "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                "created_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )

    return AuthResponse(
        token=session_token,
        user=UserOut(
            user_id=user["user_id"],
            email=user["email"],
            name=user["name"],
            picture=user.get("picture"),
        ),
    )


@api_router.get("/auth/me", response_model=UserOut)
async def auth_me(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    return UserOut(
        user_id=user["user_id"],
        email=user["email"],
        name=user["name"],
        picture=user.get("picture"),
    )


@api_router.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------- Posts ----------
WORD_RE = re.compile(r"^[A-Za-zÀ-ÿ0-9]{1,20}$")


async def serialize_post(doc: dict, current_user_id: Optional[str]) -> PostOut:
    user_vote = None
    if current_user_id:
        v = await db.votes.find_one(
            {"post_id": doc["post_id"], "user_id": current_user_id},
            {"_id": 0, "vote": 1},
        )
        if v:
            user_vote = v["vote"]
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
        user_vote=user_vote,
    )


@api_router.post("/posts", response_model=PostOut)
async def create_post(payload: PostCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    word = payload.word.strip()
    if not WORD_RE.match(word):
        raise HTTPException(status_code=400, detail="A palavra deve conter apenas letras/números (sem espaços), até 20 caracteres.")
    if not payload.image_base64 or len(payload.image_base64) < 50:
        raise HTTPException(status_code=400, detail="Imagem é obrigatória.")

    post = {
        "post_id": f"post_{uuid.uuid4().hex[:12]}",
        "word": word.upper(),
        "image_base64": payload.image_base64,
        "author_id": user["user_id"],
        "author_name": user["name"],
        "author_picture": user.get("picture"),
        "created_at": datetime.now(timezone.utc),
        "aprovo_count": 0,
        "desaprovo_count": 0,
    }
    await db.posts.insert_one(post.copy())
    return await serialize_post(post, user["user_id"])


@api_router.get("/posts", response_model=List[PostOut])
async def list_posts(authorization: Optional[str] = Header(None)):
    user = await get_optional_user(authorization)
    current_user_id = user["user_id"] if user else None
    cursor = db.posts.find({}, {"_id": 0}).sort("created_at", -1).limit(100)
    docs = await cursor.to_list(length=100)
    return [await serialize_post(d, current_user_id) for d in docs]


@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    if post["author_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    await db.posts.delete_one({"post_id": post_id})
    await db.votes.delete_many({"post_id": post_id})
    return {"ok": True}


# ---------- Votes ----------
@api_router.post("/posts/{post_id}/vote", response_model=PostOut)
async def vote_post(post_id: str, payload: VoteRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")

    existing = await db.votes.find_one(
        {"post_id": post_id, "user_id": user["user_id"]}, {"_id": 0}
    )

    new_vote = payload.vote
    if existing and existing["vote"] == new_vote:
        # Toggle off: remove vote
        await db.votes.delete_one({"post_id": post_id, "user_id": user["user_id"]})
        dec_field = f"{new_vote}_count"
        await db.posts.update_one({"post_id": post_id}, {"$inc": {dec_field: -1}})
    elif existing:
        # Change vote
        await db.votes.update_one(
            {"post_id": post_id, "user_id": user["user_id"]},
            {"$set": {"vote": new_vote, "updated_at": datetime.now(timezone.utc)}},
        )
        await db.posts.update_one(
            {"post_id": post_id},
            {"$inc": {f"{new_vote}_count": 1, f"{existing['vote']}_count": -1}},
        )
    else:
        # New vote
        await db.votes.insert_one({
            "post_id": post_id,
            "user_id": user["user_id"],
            "vote": new_vote,
            "created_at": datetime.now(timezone.utc),
        })
        await db.posts.update_one(
            {"post_id": post_id}, {"$inc": {f"{new_vote}_count": 1}}
        )

    updated = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    return await serialize_post(updated, user["user_id"])


@api_router.get("/")
async def root():
    return {"message": "Besord API", "status": "ok"}


app.include_router(api_router)

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
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("user_id")
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.posts.create_index("post_id", unique=True)
        await db.posts.create_index([("created_at", -1)])
        await db.votes.create_index([("post_id", 1), ("user_id", 1)], unique=True)
    except Exception as e:
        logger.warning(f"Index setup warning: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
