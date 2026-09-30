"use client";

import { cn } from "@/lib/utils";
import { OPTION_LETTERS } from "@/lib/game";
import type { ActivityType } from "@/lib/types";

export interface ChoicePickerProps {
  type: ActivityType;
  prompt: string;
  options: string[];
  value: (string | number)[] | null;
  onChange: (v: (string | number)[]) => void;
  disabled?: boolean;
  /** Once revealed, mark which option was correct. */
  correctIndex?: number | null;
  /** Show my pick + correctness after reveal. */
  submitted?: boolean;
  size?: "md" | "lg";
}

/**
 * Touch-first answer surface used by students. Big targets, single tap to
 * lock in (PRD §17: large touch targets, minimal navigation).
 */
export function ChoicePicker({
  type,
  options,
  value,
  onChange,
  disabled = false,
  correctIndex = null,
  submitted = false,
  size = "md",
}: ChoicePickerProps) {
  const selected = value?.[0];

  const handle = (i: number) => {
    if (disabled) return;
    onChange([i]);
  };

  const twoUp = type === "true_false" || options.length === 2;

  return (
    <div
      className={cn(
        "grid gap-3 w-full",
        twoUp ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
      )}
      role="group"
      aria-label="Answer choices"
    >
      {options.map((opt, i) => {
        const isSelected = selected === i;
        const isCorrect = correctIndex !== null && i === correctIndex;
        const showAsCorrect = submitted && isCorrect;
        const showAsWrong = submitted && isSelected && !isCorrect;

        return (
          <button
            key={i}
            type="button"
            onClick={() => handle(i)}
            disabled={disabled}
            aria-pressed={isSelected}
            className={cn(
              "group relative flex w-full items-center gap-3 rounded-2xl border-2 bg-card text-left transition-all duration-150",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              size === "lg" ? "min-h-20 px-5 py-4" : "min-h-16 px-4 py-3",
              twoUp && size === "lg" && "justify-center text-center",
              disabled && "cursor-default",
              !disabled && !isSelected && "hover:-translate-y-0.5 hover:border-[var(--ember)]/60 hover:shadow-md active:translate-y-0",
              isSelected && !showAsWrong && !showAsCorrect
                ? "border-[var(--ember)] bg-[var(--ember)]/10 shadow-[0_6px_20px_-8px_rgba(245,113,31,0.65)]"
                : "border-border",
              showAsCorrect && "border-success bg-success/12",
              showAsWrong && "border-destructive bg-destructive/10",
            )}
          >
            <span
              className={cn(
                "grid shrink-0 place-items-center rounded-xl font-display font-extrabold text-white",
                size === "lg" ? "size-11 text-lg" : "size-9 text-sm",
                isSelected && !showAsWrong && !showAsCorrect
                  ? "bg-[var(--ember)]"
                  : showAsCorrect
                    ? "bg-success"
                    : showAsWrong
                      ? "bg-destructive"
                      : "bg-muted-foreground/70 group-hover:bg-[var(--ember)]/70",
              )}
            >
              {type === "true_false" ? (i === 0 ? "T" : "F") : OPTION_LETTERS[i] ?? i + 1}
            </span>
            <span
              className={cn(
                "flex-1 font-semibold break-words",
                size === "lg" ? "text-lg sm:text-xl" : "text-base",
                twoUp && size === "lg" && "text-center",
              )}
            >
              {opt || `Option ${OPTION_LETTERS[i] ?? i + 1}`}
            </span>
            {showAsCorrect && (
              <span className="shrink-0 font-display text-lg font-extrabold text-success">✓</span>
            )}
            {showAsWrong && (
              <span className="shrink-0 font-display text-lg font-extrabold text-destructive">✕</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
