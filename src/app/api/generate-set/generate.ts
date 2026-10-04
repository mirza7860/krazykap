/**
 * SERVER-ONLY. The Gemini call for POST /api/generate-set, plus the
 * validate-everything pass that turns a raw model reply into questions the
 * review UI is allowed to show.
 *
 * Colocated with the route on purpose: nothing in this folder is imported
 * by client code, so `GEMINI_API_KEY` (read straight from process.env — a
 * non-NEXT_PUBLIC_ variable is server-only by Next.js design) can never be
 * inlined into the browser bundle.
 */
import { ApiError, GoogleGenAI } from "@google/genai";
import type { GenerateSetRequest, GeneratedQuestion } from "@/lib/ai-set";
import {
  GEMINI_RESPONSE_SCHEMA,
  SYSTEM_INSTRUCTION,
  buildUserPrompt,
  generatedQuestionSchema,
  normalizeGenerated,
} from "@/lib/ai-set.server";

/** The free AI Studio tier the teachers' key is provisioned for. */
const MODEL = "gemini-3.5-flash-lite";

/** A failure with a stable code the UI can turn into a friendly toast. */
export class GenerateSetError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GenerateSetError";
  }
}

export async function generateSet(
  req: GenerateSetRequest,
): Promise<{ questions: GeneratedQuestion[]; dropped: number }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GenerateSetError(
      "server_not_configured",
      "The AI generator isn't configured on this server yet.",
      500,
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  let text: string | undefined;
  try {
    // Structured output: responseSchema + responseMimeType pin the reply to
    // JSON in exactly this shape, so "valid JSON or nothing" holds even when
    // the model would rather chat. (Google-Search grounding is deliberately
    // off — it forces free-text answers and is incompatible with the schema.)
    const response = await ai.models.generateContent({
      model: MODEL,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
        temperature: 0.7,
      },
      contents: [{ role: "user", parts: [{ text: buildUserPrompt(req) }] }],
    });
    text = response.text;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 429) {
        throw new GenerateSetError(
          "rate_limited",
          "The AI quota is busy right now — give it about a minute and try again.",
          429,
        );
      }
      throw new GenerateSetError(
        "upstream_failed",
        `The AI service refused the request (${err.status}).`,
        502,
      );
    }
    throw err;
  }

  if (!text) {
    throw new GenerateSetError("empty_response", "The AI returned an empty reply.", 502);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GenerateSetError("invalid_output", "The AI reply wasn't readable JSON.", 502);
  }

  // Schema wraps the set in { questions }; a bare array is tolerated too.
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { questions?: unknown }).questions)
      ? ((parsed as { questions: unknown[] }).questions)
      : null;
  if (!list) {
    throw new GenerateSetError("invalid_output", "The AI reply had no question list.", 502);
  }

  // Per-question validation: a single malformed question is dropped, the
  // set survives. The UI is told how many didn't make it.
  const questions: GeneratedQuestion[] = [];
  for (const raw of list) {
    const result = generatedQuestionSchema.safeParse(normalizeGenerated(raw));
    if (result.success) questions.push(result.data);
  }
  const dropped = list.length - questions.length;

  if (questions.length === 0) {
    throw new GenerateSetError(
      "invalid_output",
      "None of the generated questions passed validation — try again.",
      502,
    );
  }

  return { questions, dropped };
}
