const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = "https://eu.i.posthog.com";

export async function track(
  event: string,
  distinctId: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  if (!POSTHOG_KEY || !distinctId) return;
  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event,
        distinct_id: distinctId,
        properties: { ...properties, $lib: "besord-app" },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {}
}
