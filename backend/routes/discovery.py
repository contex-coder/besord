"""
Discovery routes: themes, BW wallet, BestWord Styles (follow/unfollow), trends.

These are read-mostly endpoints with low coupling to the rest of server.py.
Mounted under /api via api_router.include_router(...).
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, Literal

from fastapi import APIRouter, HTTPException, Header, Query

from themes import THEMES, THEME_KEYS


def build_router(db, get_current_user, get_optional_user, WORD_RE, normalize_word, moderate_word) -> APIRouter:
    router = APIRouter()

    # ---------------- Themes ----------------
    @router.get("/themes")
    async def list_themes():
        return THEMES

    # ---------------- BW Wallet ----------------
    @router.get("/wallet/me")
    async def wallet_me(authorization: Optional[str] = Header(None),
                        limit: int = Query(30, ge=1, le=200)):
        user = await get_current_user(authorization)
        bal = int(user.get("bw_balance", 0) or 0)
        earned = int(user.get("bw_total_earned", 0) or 0)
        spent = max(0, earned - bal)
        txs = await db.bw_transactions.find(
            {"user_id": user["user_id"]}, {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(length=limit)
        for t in txs:
            if isinstance(t.get("created_at"), datetime):
                t["created_at"] = t["created_at"].isoformat()
        return {
            "balance": bal,
            "total_earned": earned,
            "total_spent": spent,
            "transactions": txs,
        }

    # ---------------- BestWord Styles ----------------
    @router.get("/styles/me")
    async def list_followed_styles(authorization: Optional[str] = Header(None)):
        user = await get_current_user(authorization)
        rows = await db.followed_styles.find(
            {"user_id": user["user_id"]}, {"_id": 0}
        ).sort("followed_at", -1).to_list(length=200)
        for r in rows:
            if isinstance(r.get("followed_at"), datetime):
                r["followed_at"] = r["followed_at"].isoformat()
        return {"words": [r["word"] for r in rows], "items": rows}

    @router.post("/styles/{word}/follow")
    async def follow_style(word: str, authorization: Optional[str] = Header(None)):
        user = await get_current_user(authorization)
        w = normalize_word(word.strip())
        if not WORD_RE.match(w):
            raise HTTPException(status_code=400, detail="Palavra inválida")
        ok, reason = moderate_word(w)
        if not ok:
            raise HTTPException(status_code=400, detail=reason)
        await db.followed_styles.update_one(
            {"user_id": user["user_id"], "word": w},
            {"$setOnInsert": {"user_id": user["user_id"], "word": w,
                              "followed_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        return {"ok": True, "word": w, "following": True}

    @router.delete("/styles/{word}/follow")
    async def unfollow_style(word: str, authorization: Optional[str] = Header(None)):
        user = await get_current_user(authorization)
        w = normalize_word(word.strip())
        await db.followed_styles.delete_one({"user_id": user["user_id"], "word": w})
        return {"ok": True, "word": w, "following": False}

    @router.get("/styles/{word}/status")
    async def style_status(word: str, authorization: Optional[str] = Header(None)):
        w = normalize_word(word.strip())
        user = await get_optional_user(authorization)
        if not user:
            total = await db.followed_styles.count_documents({"word": w})
            return {"following": False, "follower_count": total, "word": w}
        mine = await db.followed_styles.find_one(
            {"user_id": user["user_id"], "word": w}, {"_id": 1})
        total = await db.followed_styles.count_documents({"word": w})
        return {"following": bool(mine), "follower_count": total, "word": w}

    # ---------------- Trends ----------------
    @router.get("/trends")
    async def trends(scope: Literal["world", "country", "city"] = Query("world"),
                     country_code: Optional[str] = Query(None),
                     city: Optional[str] = Query(None),
                     period: Literal["24h", "7d", "30d"] = Query("24h"),
                     limit: int = Query(20, ge=1, le=50),
                     theme: Optional[str] = Query(None)):
        hours = {"24h": 24, "7d": 168, "30d": 720}[period]
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        vote_match: dict = {"created_at": {"$gte": since}}
        if scope == "country" and country_code:
            vote_match["geo.country_code"] = country_code.upper()
        elif scope == "city" and city:
            vote_match["geo.city"] = city
        pipeline = [
            {"$match": vote_match},
            {"$lookup": {"from": "posts", "localField": "post_id",
                         "foreignField": "post_id", "as": "p"}},
            {"$unwind": "$p"},
            *([{"$match": {"p.theme": theme}}] if (theme and theme in THEME_KEYS) else []),
            {"$match": {"p.hidden": {"$ne": True}}},
            {"$group": {"_id": "$p.word",
                        "votes": {"$sum": 1},
                        "aprovo": {"$sum": {"$cond": [{"$eq": ["$vote", "aprovo"]}, 1, 0]}},
                        "theme": {"$first": "$p.theme"}}},
            {"$sort": {"votes": -1}},
            {"$limit": limit},
        ]
        rows = await db.votes.aggregate(pipeline).to_list(length=limit)
        out = []
        for r in rows:
            v = r.get("votes", 0)
            a = r.get("aprovo", 0)
            out.append({
                "word": r["_id"],
                "theme": r.get("theme"),
                "votes": v,
                "aprovo_pct": round((a / v) * 100) if v else 0,
            })
        return {"scope": scope, "period": period, "country_code": country_code,
                "city": city, "theme": theme, "items": out}

    return router
