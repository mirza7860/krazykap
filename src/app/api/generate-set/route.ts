/**
 * POST /api/generate-set — writes a whole question set with Gemini.
 *
 * Server-only by construction (Next.js route handler): the Gemini key is
 * read from process.env.GEMINI_API_KEY — a non-NEXT_PUBLIC_ variable is
 * never exposed to the browser — and the key never appears in the response.
 *
 * Guards, in order: a signed-in teacher (same getClaims() check the proxy
 * uses), a per-teacher throttle under the free tier's 15 rpm, then a strict
 * zod check of the request. What comes back from Gemini is validated again
 * in ./generate before the client ever sees it.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { generateSet, GenerateSetError } from "./generate";
import { generateSetRequestSchema } from "@/lib/ai-set.server";

export const runtime = "nodejs";

/** Free-tier courtesy limit: 5 generations/teacher/minute (upstream: 15 rpm). */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return Response.json(body, { status, headers });
}

async function requireTeacher(): Promise<{ id: string } | Response> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return json({ error: "server_not_configured", message: "Auth isn't configured." }, 500);
  }

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        },
      },
    });
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (!claims) {
      return json({ error: "not_authenticated", message: "Sign in first." }, 401);
    }
    return { id: String(claims.sub ?? "unknown") };
  } catch {
    return json({ error: "server_not_configured", message: "Auth isn't configured." }, 500);
  }
}

export async function POST(request: Request) {
  const teacher = await requireTeacher();
  if (teacher instanceof Response) return teacher;

  // Throttle before doing any parsing or upstream work.
  const now = Date.now();
  const history = (recent.get(teacher.id) ?? []).filter((t) => now - t < WINDOW_MS);
  if (history.length >= MAX_PER_WINDOW) {
    const retryAfter = Math.max(
      1,
      Math.ceil((WINDOW_MS - (now - history[0])) / 1000),
    );
    return json(
      {
        error: "rate_limited",
        message: `You're generating quickly — wait ${retryAfter}s and try again.`,
      },
      429,
      { "Retry-After": String(retryAfter) },
    );
  }
  history.push(now);
  recent.set(teacher.id, history);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "invalid_request", message: "Expected a JSON body." }, 400);
  }

  const parsed = generateSetRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return json(
      {
        error: "invalid_request",
        message: parsed.error.issues[0]?.message ?? "Invalid request.",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      400,
    );
  }

  try {
    const result = await generateSet(parsed.data);
    return json(result);
  } catch (err) {
    if (err instanceof GenerateSetError) {
      return json({ error: err.code, message: err.message }, err.status);
    }
    console.error("[generate-set] unexpected failure:", err);
    return json({ error: "internal", message: "Something went wrong generating the set." }, 500);
  }
}
