/**
 * SERVER-ONLY. Zod schemas, normalisation, the prompt and the Gemini
 * structured-output schema for POST /api/generate-set.
 *
 * Import this only from route handlers — it reads like a plain module, but
 * nothing here should ever reach the browser (the client gets its types
 * from ai-set.ts instead).
 */
import { Type, type Schema } from "@google/genai";
import { z } from "zod";
import {
  DIFFICULTY_LEVELS,
  MAX_SET_SIZE,
  MIN_SET_SIZE,
  QUESTION_TYPES,
  SET_DIFFICULTIES,
  type GenerateSetRequest,
} from "./ai-set";

/* ------------------------------------------------------------------ input */

/** What the dialog is allowed to ask the server to generate. */
export const generateSetRequestSchema = z.object({
  brief: z
    .string()
    .trim()
    .min(3, "Describe the questions in a few words")
    .max(600, "Keep the brief under 600 characters"),
  count: z
    .number()
    .int()
    .min(MIN_SET_SIZE, `At least ${MIN_SET_SIZE} questions`)
    .max(MAX_SET_SIZE, `At most ${MAX_SET_SIZE} questions`),
  difficulty: z.enum(SET_DIFFICULTIES),
  types: z
    .array(z.enum(QUESTION_TYPES))
    .min(1, "Pick at least one question type")
    .max(QUESTION_TYPES.length),
});

/* -------------------------------------------------------------- normalise */

const NUMERIC = /^-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?$/;

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/**
 * First number hiding in a value — "9.8" stays "9.8", "9.81 m/s²" becomes
 * "9.81". Units belong in the prompt, never in the answer key, and a model
 * that puts them there anyway should lose the unit, not the question.
 */
function extractNumber(v: unknown): number {
  const s = str(v).trim();
  const m = s.match(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/);
  if (m) return Number(m[0]);
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function clampTimer(v: unknown): number {
  const n = Math.round(Number(str(v)));
  if (!Number.isFinite(n)) return 30;
  return Math.min(90, Math.max(10, n));
}

/**
 * Coerce one raw model object into the shape the schema wants, so that a
 * recoverable quirk (case, units in the answer, a blank option, `"1"` for a
 * True/False index) survives instead of costing the teacher a question.
 * Anything still wrong after this is rejected by `generatedQuestionSchema`.
 *
 * Runs before validation, so the schema itself only ever sees clean data:
 * choice indexes are already integers, True/False already reads
 * `["True","False"]` with `[0|[1]]`, numerical already reads
 * `["value","tolerance"]`.
 */
export function normalizeGenerated(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;
  const q = raw as Record<string, unknown>;
  const type = str(q.type).trim();

  const difficultyText = str(q.difficulty).trim();
  const base = {
    prompt: str(q.prompt).trim(),
    explanation: str(q.explanation).trim(),
    difficulty: (DIFFICULTY_LEVELS as readonly string[]).includes(difficultyText)
      ? difficultyText
      : "Medium",
    timer_seconds: clampTimer(q.timer_seconds),
  };

  if (type === "numerical") {
    const ca = Array.isArray(q.correct_answer) ? q.correct_answer : [];
    const value = extractNumber(ca[0]);
    const tolText = str(ca[1]).trim();
    const tolerance = tolText === "" ? 0 : extractNumber(tolText);
    return {
      ...base,
      type,
      options: [],
      correct_answer: [
        Number.isFinite(value) ? String(value) : str(ca[0]).trim(),
        Number.isFinite(tolerance) && tolerance >= 0 ? String(tolerance) : "0",
      ],
    };
  }

  if (type === "true_false") {
    // The bank always stores True first, so the order is fixed here no
    // matter what the model listed; only the side of the answer matters.
    const ca = Array.isArray(q.correct_answer) ? q.correct_answer : [];
    const text = str(ca[0]).trim().toLowerCase();
    let index: number;
    if (text === "true" || text === "t") index = 0;
    else if (text === "false" || text === "f") index = 1;
    else {
      const n = Math.round(Number(text));
      index = n === 0 || n === 1 ? n : -1;
    }
    return { ...base, type, options: ["True", "False"], correct_answer: [index] };
  }

  // Choice types: trim options, drop blanks and remap the correct index so
  // removing a blank slot can never shift the answer onto another option.
  const listed = (Array.isArray(q.options) ? q.options : [])
    .map((o) => str(o).trim())
    .slice(0, 4);
  const kept: string[] = [];
  const remap = new Map<number, number>();
  listed.forEach((option, i) => {
    if (option !== "") {
      remap.set(i, kept.length);
      kept.push(option);
    }
  });
  const ca = Array.isArray(q.correct_answer) ? q.correct_answer : [];
  const rawIndex = Math.round(Number(str(ca[0])));
  const index = remap.has(rawIndex) ? remap.get(rawIndex)! : -1;
  return { ...base, type, options: kept, correct_answer: [index] };
}

/* -------------------------------------------------------------- validation */

/**
 * The hard contract. Each question is parsed on its own, so one bad apple
 * (a 6-option MCQ, an unparseable number) is dropped without taking the
 * rest of the set down with it.
 */
export const generatedQuestionSchema = z
  .object({
    prompt: z.string().min(4, "Prompt too short").max(800, "Prompt too long"),
    type: z.enum(QUESTION_TYPES),
    options: z.array(z.string().min(1, "Empty option").max(220, "Option too long")),
    correct_answer: z.array(z.union([z.string(), z.number()])),
    explanation: z
      .string()
      .min(3, "Explanation too short")
      .max(1000, "Explanation too long"),
    timer_seconds: z.number().int().min(10).max(90),
    difficulty: z.enum(DIFFICULTY_LEVELS),
  })
  .superRefine((q, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });

    if (q.type === "numerical") {
      if (q.options.length !== 0) fail("options", "Numerical answers take no options");
      if (q.correct_answer.length !== 2) {
        fail("correct_answer", "Numerical needs [value, tolerance]");
      } else if (!NUMERIC.test(String(q.correct_answer[0]))) {
        fail("correct_answer", "Numerical value is not a number");
      } else if (!NUMERIC.test(String(q.correct_answer[1]))) {
        fail("correct_answer", "Tolerance is not a number");
      }
      return;
    }

    if (q.type === "true_false") {
      if (q.correct_answer.length !== 1 || !Number.isInteger(Number(q.correct_answer[0]))) {
        fail("correct_answer", "True/False needs one index");
      } else if (Number(q.correct_answer[0]) !== 0 && Number(q.correct_answer[0]) !== 1) {
        fail("correct_answer", "True/False index must be 0 or 1");
      }
      return;
    }

    if (q.options.length < 2 || q.options.length > 4) {
      fail("options", "Choice questions need 2–4 options");
    }
    if (q.correct_answer.length !== 1) {
      fail("correct_answer", "Choice questions need exactly one correct index");
      return;
    }
    const index = Number(q.correct_answer[0]);
    if (!Number.isInteger(index) || index < 0 || index >= q.options.length) {
      fail("correct_answer", "Correct index is outside the option list");
    }
  });

export type ParsedGeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

/* ------------------------------------------------------------------ prompt */

/**
 * The system instruction — the part that makes the output good. It pins
 * every rule the bank and the player depend on (answer-key shape per type,
 * units, timers, distractor quality) so the schema only has to police the
 * structure, not the pedagogy.
 */
export const SYSTEM_INSTRUCTION = `You are the question writer for Rain of Physics, a live classroom quiz platform. Physics teachers run real-time quizzes with your questions: each one is projected on a screen and answered on phones under a timer. Everything you write must be unambiguous, physically correct, and answerable from the prompt alone.

Return only the JSON object your schema defines — no commentary, no markdown, no extra keys.

Question types:
- mcq: 4 options preferred (2–4 allowed), exactly one unambiguously correct. correct_answer is a one-element array holding the 0-based index of the correct option as a string, e.g. ["2"]. Distractors must target common misconceptions. Never "All of the above" / "None of the above".
- true_false: options are always ["True","False"]. correct_answer ["0"] means True, ["1"] means False. The statement must be precisely falsifiable — no weasel words.
- prediction: students commit to an expected outcome before seeing data. options are 2–4 mutually exclusive outcomes; correct_answer is the index of the outcome physics predicts.
- numerical: options must be []. correct_answer is ["value","tolerance"] — plain numbers only, no units (e.g. ["9.8","0.1"]). Put the quantity and SI unit in the prompt. Tolerance is normally 1–3% of the value; 0 only for exact integers.
- find_error: the prompt contains a short worked solution with exactly one genuine mistake. options are 2–4 quoted candidate steps; correct_answer is the index of the step that is actually wrong.
- exit_ticket: a quick end-of-lesson check of the key idea, 2–4 options with one correct index.

Difficulty: "Easy" recall or definition; "Medium" one-step application; "Hard" multi-step or combined concepts; "Boss" competition-grade reasoning.
timer_seconds: an integer from 10 to 90 reflecting how long a strong student needs — 20–30 Easy, 30–45 Medium, 45–75 Hard/Boss.
explanation: 1–3 sentences naming why the answer is right and the physics behind it; for numerical, show the working compactly (e.g. "F = m·a = 5 × 2 = 10 N.").

Style: grade 8–12 classroom voice; SI units; every prompt self-contained (state every given value); no trick wording, no cultural assumptions, no bias; never two questions in one.`;

/** The teacher's brief, translated into instructions for one coherent set. */
export function buildUserPrompt(req: GenerateSetRequest): string {
  const mix =
    req.difficulty === "Mixed"
      ? "a healthy mix of Easy, Medium and Hard (at most one Boss)"
      : `${req.difficulty} throughout`;
  return [
    `Write exactly ${req.count} questions.`,
    `Teacher's brief: ${req.brief.trim()}`,
    `Difficulty: ${mix}.`,
    `Allowed types only: ${req.types.join(", ")}. Spread them naturally across the set instead of using one type for everything.`,
    "Make it feel like one coherent quiz: open with a warm-up, build to the hardest question last, and do not repeat a concept twice in the same wording.",
  ].join("\n");
}

/* -------------------------------------------------- structured output schema */

const QUESTION_SCHEMA: Schema = {
  type: Type.OBJECT,
  description: "One classroom question in Rain of Physics format.",
  properties: {
    prompt: {
      type: Type.STRING,
      description: "The question text, self-contained, SI units, ≤ 2 sentences.",
    },
    type: {
      type: Type.STRING,
      format: "enum",
      enum: [...QUESTION_TYPES],
      description: "Which of the allowed question types this is.",
    },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Choice options (2–4). [] for numerical, exactly [\"True\",\"False\"] for true_false.",
    },
    correct_answer: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "mcq/prediction/find_error/exit_ticket: [\"i\"] with the 0-based option index. true_false: [\"0\"] True or [\"1\"] False. numerical: [\"value\",\"tolerance\"] as plain numbers without units.",
    },
    explanation: {
      type: Type.STRING,
      description: "1–3 sentences: why the answer is right, and the physics behind it.",
    },
    timer_seconds: {
      type: Type.INTEGER,
      description: "Seconds a strong student needs, 10–90.",
    },
    difficulty: {
      type: Type.STRING,
      format: "enum",
      enum: [...DIFFICULTY_LEVELS],
      description: "Easy | Medium | Hard | Boss.",
    },
  },
  required: [
    "prompt",
    "type",
    "options",
    "correct_answer",
    "explanation",
    "timer_seconds",
    "difficulty",
  ],
  propertyOrdering: [
    "prompt",
    "type",
    "options",
    "correct_answer",
    "explanation",
    "timer_seconds",
    "difficulty",
  ],
};

/**
 * Root object rather than a bare array: object roots are the most
 * portable shape across Gemini versions, and unwrapping is one line.
 */
export const GEMINI_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      description: "The generated set. Contains exactly the number requested.",
      items: QUESTION_SCHEMA,
    },
  },
  required: ["questions"],
  propertyOrdering: ["questions"],
};
