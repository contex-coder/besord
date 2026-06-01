/**
 * Coerce FastAPI/Pydantic error responses into a friendly string.
 * Backend returns `detail` as:
 *  - string (HTTPException) → use as-is
 *  - array of error objects (Pydantic 422) → join messages
 *  - object → fallback to fallback
 */
export function errorMessage(body: any, fallback: string = "Algo correu mal."): string {
  if (!body) return fallback;
  const d = body.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    const msgs = d.map((e: any) => {
      if (typeof e === "string") return e;
      if (e?.msg) return e.msg;
      return null;
    }).filter(Boolean);
    if (msgs.length) return msgs.join(" · ");
  }
  if (typeof body.message === "string") return body.message;
  return fallback;
}
