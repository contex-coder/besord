"""
Expo Push Notifications — fire-and-forget helper.
Envia notificações reais via Expo Push API (https://exp.host/--/api/v2/push/send).
Invalida tokens com DeviceNotRegistered automaticamente.
"""
import httpx
import logging

log = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
BATCH_SIZE = 100


async def send_push_to_user(db, user_id: str, title: str, body: str, data: dict = None) -> None:
    """Busca tokens Expo válidos do utilizador e envia push real. Nunca levanta excepção."""
    try:
        tokens_cursor = db.push_tokens.find(
            {"user_id": user_id, "is_valid": {"$ne": False}},
            {"_id": 0, "token": 1}
        )
        tokens = [doc["token"] async for doc in tokens_cursor]
        messages = [
            {"to": t, "title": title, "body": body, "data": data or {}, "sound": "default"}
            for t in tokens
            if isinstance(t, str) and t.startswith("ExponentPushToken")
        ]
        if not messages:
            return

        async with httpx.AsyncClient(timeout=10.0) as client:
            for i in range(0, len(messages), BATCH_SIZE):
                batch = messages[i:i + BATCH_SIZE]
                batch_tokens = tokens[i:i + BATCH_SIZE]
                try:
                    r = await client.post(
                        EXPO_PUSH_URL,
                        json=batch,
                        headers={"Content-Type": "application/json", "Accept": "application/json"},
                    )
                    receipts = r.json().get("data", [])
                    await _handle_receipts(db, receipts, batch_tokens)
                except Exception as e:
                    log.warning(f"[push] batch failed for {user_id}: {e}")
    except Exception as e:
        log.warning(f"[push] send_push_to_user failed for {user_id}: {e}")


async def _handle_receipts(db, receipts: list, tokens: list) -> None:
    """Invalida tokens com erro DeviceNotRegistered."""
    for i, receipt in enumerate(receipts):
        if not isinstance(receipt, dict):
            continue
        if receipt.get("status") == "error":
            details = receipt.get("details") or {}
            if details.get("error") == "DeviceNotRegistered":
                if i < len(tokens):
                    try:
                        await db.push_tokens.update_one(
                            {"token": tokens[i]},
                            {"$set": {"is_valid": False}}
                        )
                    except Exception:
                        pass
