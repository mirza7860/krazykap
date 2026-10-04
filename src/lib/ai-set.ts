/**
 * Vocabulary and wire types for the AI set generator.
 *
 * Shared by the dialog (client) and POST /api/generate-set (server). The API
 * key, the prompt text, the zod schemas and the Gemini call live in
 * ai-set.server.ts and the route instead, so importing anything from this
 * file can never pull server code — or the key — into the browser bundle.
 */

/** Every question type the bank understands, in bank order. */
export const QUESTION_TYPES = [
  "mcq",
  "true_false",
  "prediction",
  "numerical",
  "find_error",
  "exit_ticket",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Short labels for the type chips — same words the bank's filter uses. */
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "MCQ",
  true_false: "True / False",
  prediction: "Prediction",
  numerical: "Numerical",
  find_error: "Find the Error",
  exit_ticket: "Exit Ticket",
};

export const DIFFICULTY_LEVELS = ["Easy", "Medium", "Hard", "Boss"] as const;

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

/**
 * What the teacher picks. "Mixed" only rides along in the prompt — every
 * stored question still carries one concrete difficulty.
 */
export const SET_DIFFICULTIES = ["Mixed", ...DIFFICULTY_LEVELS] as const;

export type SetDifficulty = (typeof SET_DIFFICULTIES)[number];

/** One generated question, as the review step sees it before approval. */
export interface GeneratedQuestion {
  prompt: string;
  type: QuestionType;
  options: string[];
  correct_answer: (string | number)[];
  explanation: string;
  timer_seconds: number;
  difficulty: DifficultyLevel;
}

/** Exactly what the dialog POSTs to /api/generate-set. */
export interface GenerateSetRequest {
  brief: string;
  count: number;
  difficulty: SetDifficulty;
  types: QuestionType[];
}

/** Server response. `dropped` counts items that failed validation. */
export interface GenerateSetResponse {
  questions: GeneratedQuestion[];
  dropped: number;
}

/** Kept small on purpose: one call writes the whole set, 15 rpm upstream. */
export const MIN_SET_SIZE = 3;
export const MAX_SET_SIZE = 12;
