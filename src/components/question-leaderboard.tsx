"use client";

import { CheckCircle2, Timer, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuestionLeaderboardRow } from "@/lib/types";

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * Per-question leaderboard.
 *
 * Deliberately NOT the session-wide `Leaderboard`: this ranks only the students
 * who answered *this* question, by what they earned on it. Rows come from
 * `public.question_leaderboard()` in schema.sql so the teacher's laptop, the
 * projector and every phone render the exact same ordering.
 *
 * The answer is already public at this point (the teacher revealed it), so
 * showing correctness and reaction time leaks nothing new.
 *
 * `viewportRows` is what keeps a 40-student room from growing the screen: the
 * list is clamped to that many rows tall and scrolls inside its own box, with
 * no scrollbar drawn (see `no-scrollbar` in globals.css).
 */
export function QuestionLeaderboard({
  rows,
  highlightId,
  max = 20,
  dense = false,
  viewportRows,
}: {
  rows: QuestionLeaderboardRow[];
  highlightId?: string;
  max?: number;
  dense?: boolean;
  viewportRows?: number;
}) {
  const shown = (rows ?? []).slice(0, max);

  if (shown.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-8 text-center">
        <p className="font-display text-base font-bold">No answers to rank</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The board fills in the moment students lock in an answer.
        </p>
      </div>
    );
  }

  return (
    <ol
      className={cn(
        "flex w-full flex-col gap-2",
        viewportRows &&
          "no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain",
      )}
      style={
        viewportRows
          ? {
              maxHeight: `calc((var(--qlb-row-h) + var(--board-row-gap)) * ${viewportRows} - var(--board-row-gap))`,
            }
          : undefined
      }
    >
      {shown.map((row) => {
        const isMe = row.id === highlightId;
        const speed =
          row.reaction_ms === null || row.reaction_ms === undefined
            ? null
            : `${(row.reaction_ms / 1000).toFixed(1)}s`;

        return (
          <li
            key={row.id}
            className={cn(
              "flex items-center gap-3 rounded-xl border transition-all",
              dense ? "px-3 py-2" : "px-4 py-3",
              row.rank <= 3 && "border-[var(--gold)]/45 bg-[var(--gold)]/10",
              isMe
                ? "border-[var(--ember)] bg-[var(--ember)]/10 shadow-[0_0_0_1px_rgba(245,113,31,0.35)]"
                : "border-border bg-card",
            )}
          >
            <span
              className={cn(
                "grid shrink-0 place-items-center rounded-lg font-display font-extrabold tabular-nums",
                dense ? "size-7 text-xs" : "size-9 text-sm",
                row.rank <= 3 ? "bg-transparent text-lg font-emoji" : "bg-muted text-muted-foreground",
              )}
              style={{
                fontFamily:
                  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif',
              }}
            >
              {row.rank <= 3 ? MEDALS[row.rank - 1] : row.rank}
            </span>

            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate font-display font-bold",
                  dense ? "text-sm" : "text-base",
                )}
              >
                {row.nickname}
                {isMe && <span className="ml-2 text-[10px] font-bold text-[var(--primary)] uppercase">you</span>}
                {row.team && (
                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {row.team}
                  </span>
                )}
              </p>
              {!dense && (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {row.is_correct ? (
                    <>
                      <CheckCircle2 className="size-3.5 shrink-0 text-success" />
                      <span className="text-success">Correct</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="size-3.5 shrink-0 text-destructive" />
                      <span>Incorrect</span>
                    </>
                  )}
                  {speed && (
                    <span className="ml-1 inline-flex items-center gap-1 tabular-nums">
                      <Timer className="size-3" /> {speed}
                    </span>
                  )}
                </p>
              )}
            </div>

            <span
              className={cn(
                "shrink-0 font-display font-extrabold tabular-nums",
                dense ? "text-sm" : "text-base",
                row.rank === 1 ? "text-[var(--gold)]" : "text-foreground",
              )}
            >
              +{row.xp} XP
            </span>
          </li>
        );
      })}
    </ol>
  );
}
