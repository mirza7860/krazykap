// Shared domain types for Rain of Physics.
// Mirrors supabase/schema.sql — keep the two in sync.

export type RoomStatus = "lobby" | "active" | "closed" | "expired";

export type ActivityType =
  | "mcq"
  | "true_false"
  | "prediction"
  | "numerical"
  | "find_error"
  | "exit_ticket";

export type ActivityState =
  | "pending"
  | "answering"
  | "distribution"
  | "revealed"
  | "leaderboard"
  | "closed";

export type Difficulty = "Easy" | "Medium" | "Hard" | "Boss";

export type LeaderboardMode =
  | "xp"
  | "accuracy"
  | "speed"
  | "streak"
  | "participation";

export interface RoomSettings {
  streaks_enabled?: boolean;
  allow_change?: boolean;
  teams_enabled?: boolean;
  /**
   * ISO timestamp of when the teacher pressed "Final results". Lives in the
   * room's settings blob so every screen picks it up from the state RPCs it
   * already fetches — no new column, no migration, no new realtime surface.
   */
  results_revealed_at?: string | null;
}

export interface Room {
  id: string;
  code: string;
  teacher_id: string;
  title: string;
  status: RoomStatus;
  settings: RoomSettings;
  rounds_total: number;
  created_at: string;
  expires_at: string;
  closed_at: string | null;
}

export interface Participant {
  id: string;
  nickname: string;
  team: string | null;
  xp: number;
  streak: number;
  best_streak: number;
  correct_count: number;
  answered_count: number;
  connected?: boolean;
  answered_this?: boolean;
}

export interface Activity {
  id: string;
  seq: number;
  type: ActivityType;
  prompt: string;
  options: string[];
  correct_answer: (string | number)[];
  explanation: string | null;
  difficulty: Difficulty;
  topic: string | null;
  state: ActivityState;
  timer_seconds: number;
  paused: boolean;
  launched_at: string | null;
  deadline: string | null;
  revealed_at: string | null;
}

export interface StudentResponse {
  answered: boolean;
  answer?: (string | number)[];
  confidence?: number | null;
  is_correct?: boolean;
  base_points?: number;
  speed_bonus?: number;
  xp?: number;
  reaction_ms?: number;
}

export interface DistributionBucket {
  key: number;
  count: number;
}

export interface LeaderboardRow {
  rank: number;
  id: string;
  nickname: string;
  team: string | null;
  xp: number;
  streak: number;
  best_streak: number;
  correct_count: number;
  answered_count: number;
  accuracy: number | null;
  avg_speed: number | null;
  score: number;
}

/**
 * One row of the *per-question* board (public.question_leaderboard in
 * schema.sql) — only students who actually answered this question appear,
 * ranked by what they earned on it rather than by session-wide XP.
 */
export interface QuestionLeaderboardRow {
  rank: number;
  id: string;
  nickname: string;
  team: string | null;
  xp: number;
  is_correct: boolean;
  reaction_ms: number | null;
}

export interface TeacherResponseRow {
  participant_id: string;
  nickname: string;
  answer: (string | number)[];
  is_correct: boolean;
  reaction_ms: number | null;
  confidence: number | null;
  xp: number;
  submitted_at: string;
}

export interface ChallengeRow {
  id: string;
  body: string;
  status: "pending" | "approved" | "rejected";
  nickname: string;
}

export interface SessionSummary {
  students: number;
  questions: number;
  avg_accuracy: number;
  avg_response_ms: number;
  total_responses: number;
  hardest: { prompt: string; accuracy: number; wrong_answer: unknown } | null;
  leaderboard: LeaderboardRow[];
}

export interface TeacherState {
  server_time_ms: number;
  room: Room;
  participants: Participant[];
  activity: (Omit<Activity, "options"> & {
    options: string[];
    responses: TeacherResponseRow[];
    response_count: number;
    /** `[]` until the teacher shows this question's board. */
    question_leaderboard: QuestionLeaderboardRow[];
  }) | null;
  challenges: ChallengeRow[];
  leaderboard: LeaderboardRow[];
  summary: SessionSummary;
}

export interface StudentActivity {
  id: string;
  seq: number;
  type: ActivityType;
  prompt: string;
  options: string[];
  difficulty: Difficulty;
  topic: string | null;
  state: ActivityState;
  timer_seconds: number;
  paused: boolean;
  launched_at: string | null;
  deadline: string | null;
  revealed_at: string | null;
  correct_answer: (string | number)[];
  explanation: string | null;
  distribution: DistributionBucket[];
  my_response: StudentResponse | null;
  has_response: boolean;
  /** `[]` until the teacher shows this question's board. */
  question_leaderboard: QuestionLeaderboardRow[];
}

export interface StudentState {
  server_time_ms: number;
  room: {
    id: string;
    code: string;
    title: string;
    status: RoomStatus;
    expires_at: string;
    participant_count: number;
    settings: RoomSettings;
  };
  me: Participant;
  activity: StudentActivity | null;
  leaderboard: LeaderboardRow[];
  participants: (Participant & { connected: boolean })[];
}

export interface JoinResult {
  token: string;
  participant_id: string;
  room_id: string;
  room_code: string;
  room_title: string;
  nickname: string;
}

/** Activity types that present 2–4 discrete choices. */
export const CHOICE_TYPES: ActivityType[] = [
  "mcq",
  "true_false",
  "prediction",
  "find_error",
  "exit_ticket",
];

/** Activity types where a numeric answer is expected. */
export const NUMERIC_TYPES: ActivityType[] = ["numerical"];

export function isChoiceType(type: ActivityType): boolean {
  return CHOICE_TYPES.includes(type);
}

export const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  Easy: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Medium: "bg-amber-100 text-amber-900 border-amber-200",
  Hard: "bg-orange-100 text-orange-800 border-orange-200",
  Boss: "bg-rose-100 text-rose-800 border-rose-200",
};
