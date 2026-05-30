from fastapi import FastAPI, APIRouter, HTTPException, Header, Query
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

class VoteRequest(BaseModel):
    vote: Literal["aprovo", "desaprovo"]

class CommentCreate(BaseModel):
    word: str

class ReportCreate(BaseModel):
    reason: Optional[str] = None


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
        v = await db.votes.find_one(
            {"post_id": doc["post_id"], "user_id": current_user_id},
            {"_id": 0, "vote": 1},
        )
        if v:
            user_vote = v["vote"]
        c = await db.comments.find_one(
            {"post_id": doc["post_id"], "user_id": current_user_id},
            {"_id": 0, "word": 1},
        )
        if c:
            user_comment = c["word"]

    # Top 3 most recent comments
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
    email = data.get("email")
    name = data.get("name", email)
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=400, detail="Resposta de auth inválida")

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
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"name": name, "picture": picture}},
        )
        user["name"] = name
        user["picture"] = picture

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
        user=UserOut(user_id=user["user_id"], email=user["email"], name=user["name"], picture=user.get("picture")),
    )


@api_router.get("/auth/me", response_model=UserOut)
async def auth_me(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    return UserOut(user_id=user["user_id"], email=user["email"], name=user["name"], picture=user.get("picture"))


@api_router.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------- Posts ----------
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
    }
    await db.posts.insert_one(post.copy())
    return await serialize_post(post, user["user_id"])


@api_router.get("/posts", response_model=List[PostOut])
async def list_posts(
    authorization: Optional[str] = Header(None),
    sort: Literal["recent", "trending"] = Query("recent"),
    word: Optional[str] = Query(None),
):
    user = await get_optional_user(authorization)
    current_user_id = user["user_id"] if user else None

    query: dict = {"hidden": {"$ne": True}}
    if word:
        query["word"] = normalize_word(word)

    if sort == "trending":
        # Sort by total engagement (aprovo + desaprovo + comments). Tiebreak by recency.
        pipeline = [
            {"$match": query},
            {"$addFields": {"engagement": {"$add": ["$aprovo_count", "$desaprovo_count", "$comments_count"]}}},
            {"$sort": {"engagement": -1, "created_at": -1}},
            {"$limit": 100},
            {"$project": {"_id": 0}},
        ]
        docs = await db.posts.aggregate(pipeline).to_list(length=100)
    else:
        cursor = db.posts.find(query, {"_id": 0}).sort("created_at", -1).limit(100)
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
    await db.comments.delete_many({"post_id": post_id})
    await db.reports.delete_many({"post_id": post_id})
    return {"ok": True}


# ---------- Votes ----------
@api_router.post("/posts/{post_id}/vote", response_model=PostOut)
async def vote_post(post_id: str, payload: VoteRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")

    existing = await db.votes.find_one({"post_id": post_id, "user_id": user["user_id"]}, {"_id": 0})
    new_vote = payload.vote
    if existing and existing["vote"] == new_vote:
        await db.votes.delete_one({"post_id": post_id, "user_id": user["user_id"]})
        await db.posts.update_one({"post_id": post_id}, {"$inc": {f"{new_vote}_count": -1}})
    elif existing:
        await db.votes.update_one(
            {"post_id": post_id, "user_id": user["user_id"]},
            {"$set": {"vote": new_vote, "updated_at": datetime.now(timezone.utc)}},
        )
        await db.posts.update_one(
            {"post_id": post_id},
            {"$inc": {f"{new_vote}_count": 1, f"{existing['vote']}_count": -1}},
        )
    else:
        await db.votes.insert_one({
            "post_id": post_id,
            "user_id": user["user_id"],
            "vote": new_vote,
            "created_at": datetime.now(timezone.utc),
        })
        await db.posts.update_one({"post_id": post_id}, {"$inc": {f"{new_vote}_count": 1}})

    updated = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    return await serialize_post(updated, user["user_id"])


# ---------- Comments ----------
@api_router.get("/posts/{post_id}/comments", response_model=List[CommentOut])
async def list_comments(post_id: str):
    cursor = db.comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", -1).limit(200)
    docs = await cursor.to_list(length=200)
    return [comment_doc_to_out(d) for d in docs]


@api_router.post("/posts/{post_id}/comment", response_model=PostOut)
async def comment_post(post_id: str, payload: CommentCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")

    word = payload.word.strip()
    if not WORD_RE.match(word):
        raise HTTPException(status_code=400, detail="O comentário deve ser UMA palavra (letras/números, até 20).")

    normalized = normalize_word(word)
    existing = await db.comments.find_one({"post_id": post_id, "user_id": user["user_id"]}, {"_id": 0})
    if existing:
        await db.comments.update_one(
            {"comment_id": existing["comment_id"]},
            {"$set": {"word": normalized, "updated_at": datetime.now(timezone.utc), "user_name": user["name"], "user_picture": user.get("picture")}},
        )
    else:
        await db.comments.insert_one({
            "comment_id": f"cmt_{uuid.uuid4().hex[:12]}",
            "post_id": post_id,
            "user_id": user["user_id"],
            "user_name": user["name"],
            "user_picture": user.get("picture"),
            "word": normalized,
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


# ---------- Reports / Moderation ----------
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
        "report_id": f"rep_{uuid.uuid4().hex[:12]}",
        "post_id": post_id,
        "user_id": user["user_id"],
        "reason": (payload.reason or "")[:200],
        "created_at": datetime.now(timezone.utc),
    })
    updated = await db.posts.find_one_and_update(
        {"post_id": post_id},
        {"$inc": {"reports_count": 1}},
        return_document=True,
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
        await db.posts.create_index("word")
        await db.votes.create_index([("post_id", 1), ("user_id", 1)], unique=True)
        await db.comments.create_index("comment_id", unique=True)
        await db.comments.create_index([("post_id", 1), ("user_id", 1)], unique=True)
        await db.reports.create_index([("post_id", 1), ("user_id", 1)], unique=True)
    except Exception as e:
        logger.warning(f"Index setup warning: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
