import type { ActivityType, Difficulty, LeaderboardMode } from "@/lib/types";

// Re-exported so gameplay helpers read as one module.
export { OPTION_LETTERS } from "@/lib/types";

export interface QuickTemplate {
  type: ActivityType;
  label: string;
  blurb: string;
  icon: string;
  /** PRD §8 priority */
  tier: "must" | "should";
  defaults?: {
    options?: string[];
    timer?: number;
    difficulty?: Difficulty;
  };
}

/**
 * The Quick Challenge shelf (PRD §8). Teacher picks an activity type here
 * instead of walking through a setup wizard — this is the fast path that
 * keeps the lesson moving.
 */
export const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    type: "mcq",
    label: "Quick Challenge",
    blurb: "Four options, one right answer",
    icon: "target",
    tier: "must",
    defaults: { options: ["", "", "", ""], timer: 30, difficulty: "Medium" },
  },
  {
    type: "true_false",
    label: "True / False",
    blurb: "One statement, two buttons",
    icon: "scale",
    tier: "should",
    defaults: { options: ["True", "False"], timer: 15 },
  },
  {
    type: "prediction",
    label: "Prediction",
    blurb: "What happens before we run it?",
    icon: "sparkles",
    tier: "should",
    defaults: { options: ["", "", "", ""], timer: 30 },
  },
  {
    type: "numerical",
    label: "Numerical",
    blurb: "Answer with a number + tolerance",
    icon: "calculator",
    tier: "should",
    defaults: { timer: 45 },
  },
  {
    type: "find_error",
    label: "Find the Error",
    blurb: "Which step is wrong?",
    icon: "search",
    tier: "should",
    defaults: { options: ["Step 1", "Step 2", "Step 3", "Step 4"], timer: 45 },
  },
  {
    type: "exit_ticket",
    label: "Exit Ticket",
    blurb: "How well did today land?",
    icon: "door",
    tier: "should",
    defaults: {
      options: ["Understood", "Need Practice", "Still Confused"],
      timer: 30,
    },
  },
];

export const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard", "Boss"];

export const TIMERS = [10, 20, 30, 60, 90];

export const LEADERBOARD_MODES: { id: LeaderboardMode; label: string }[] = [
  { id: "xp", label: "Overall XP" },
  { id: "accuracy", label: "Accuracy" },
  { id: "speed", label: "Speed" },
  { id: "streak", label: "Streak" },
  { id: "participation", label: "Participation" },
];

/** PRD §12 — several categories so one student can't sweep every board. */
export const ACHIEVEMENT_CATEGORIES = [
  { id: "speedster", label: "Speedster", desc: "Fastest average response" },
  { id: "thinker", label: "Thinker", desc: "Highest accuracy under time" },
  { id: "sharpshooter", label: "Sharpshooter", desc: "Most correct answers" },
  { id: "streak_master", label: "Streak Master", desc: "Longest correct streak" },
  { id: "detective", label: "Detective", desc: "Best at Find the Error" },
  { id: "explainer", label: "Explainer", desc: "Challenges approved" },
  { id: "question_master", label: "Question Master", desc: "Answered every round" },
];

export const SPEED_BONUS_TABLE = [
  { window: "First 20% of timer", bonus: 50 },
  { window: "20–40%", bonus: 40 },
  { window: "40–60%", bonus: 30 },
  { window: "60–80%", bonus: 20 },
  { window: "80–100%", bonus: 10 },
] as const;

export const STREAK_MILESTONES = [
  { streak: 3, xp: 20 },
  { streak: 5, xp: 50 },
  { streak: 10, xp: 100 },
] as const;

export const CONFIDENCE_LEVELS = [50, 70, 90, 100] as const;

export const TEAM_NAMES = ["Team Alpha", "Team Beta", "Team Gamma", "Team Delta"];

export const OPTION_STYLES = [
  "border-[var(--option-a)]",
  "border-[var(--option-b)]",
  "border-[var(--option-c)]",
  "border-[var(--option-d)]",
];

export const OPTION_TEXT = [
  "text-[var(--option-a)]",
  "text-[var(--option-b)]",
  "text-[var(--option-c)]",
  "text-[var(--option-d)]",
];

export const OPTION_BG = [
  "bg-[var(--option-a)]",
  "bg-[var(--option-b)]",
  "bg-[var(--option-c)]",
  "bg-[var(--option-d)]",
];
