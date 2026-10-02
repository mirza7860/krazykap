"use client";

/**
 * Tells the room that a student's tab is going away, so their name comes off
 * every roster straight away instead of waiting out the disconnect window.
 *
 * Runs on `pagehide` — which fires for a closed tab, a refresh and navigating
 * away, but *not* for a locked phone screen — and uses `keepalive: true` so
 * the browser lets the request outlive the page itself. Supabase's own client
 * has no keepalive option, hence the hand-rolled call.
 *
 * Nothing here is load-bearing: if the request never lands (or the schema
 * hasn't been re-run yet and `leave_room` doesn't exist), the 45-second
 * staleness check in `get_room_state` still takes the seat back.
 */
export function announceLeave(token: string): void {
  if (typeof window === "undefined" || !token) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return;

  try {
    void fetch(`${url}/rest/v1/rpc/leave_room`, {
      method: "POST",
      keepalive: true,
      headers: {
        "content-type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ p_token: token }),
    }).catch(() => {
      /* the page is already on its way out — the staleness check covers us */
    });
  } catch {
    /* never let this interrupt the unload */
  }
}
