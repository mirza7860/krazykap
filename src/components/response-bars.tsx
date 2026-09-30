"use client";

import { cn } from "@/lib/utils";
import { OPTION_BG, OPTION_LETTERS } from "@/lib/game";
import type { DistributionBucket } from "@/lib/types";

/**
 * Signature feature — Live Response Distribution (PRD §10).
 *
 * Shows the aggregate A/B/C/D split WITHOUT exposing who picked what.
 * `correctIndex` stays `null` until the teacher reveals, so the class can be
 * discussed first.
 */
export function ResponseBars({
  buckets,
  total,
  optionCount,
  correctIndex,
  compact = false,
  revealPercentages = true,
}: {
  buckets: DistributionBucket[];
  total: number;
  optionCount: number;
  correctIndex: number | null;
  compact?: boolean;
  revealPercentages?: boolean;
}) {
  const counts = new Map<number, number>();
  for (const b of buckets) counts.set(b.key, b.count);

  const denom = Math.max(total, 1);
  const rows = Array.from({ length: Math.max(optionCount, 1) }, (_, i) => {
    const count = counts.get(i) ?? 0;
    const pct = total === 0 ? 0 : Math.round((count / denom) * 100);
    return { index: i, count, pct };
  });

  if (total === 0) {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-2xl border border-dashed border-border bg-card/60 text-center",
          compact ? "py-6" : "py-12",
        )}
      >
        <div>
          <p className="font-display text-lg font-bold text-foreground">
            Waiting for responses…
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Bars fill in live as the class answers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex w-full flex-col gap-3", compact ? "gap-2" : "gap-4")}>
      {rows.map((row) => {
        const isCorrect = correctIndex !== null && row.index === correctIndex;
        return (
          <div key={row.index} className="flex items-center gap-3 sm:gap-4">
            <span
              className={cn(
                "grid shrink-0 place-items-center rounded-lg font-display font-extrabold text-white",
                compact ? "size-7 text-xs" : "size-10 text-base",
                OPTION_BG[row.index % OPTION_BG.length],
              )}
            >
              {OPTION_LETTERS[row.index] ?? row.index + 1}
            </span>

            <div className="relative h-full min-h-9 flex-1 overflow-hidden rounded-xl bg-muted">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 transition-[width] duration-700 ease-out",
                  OPTION_BG[row.index % OPTION_BG.length],
                  isCorrect && "ring-2 ring-inset ring-success",
                )}
                style={{ width: `${row.pct}%` }}
              />
              <div
                className={cn(
                  "relative flex items-center justify-between px-3",
                  compact ? "h-9" : "h-12",
                )}
              >
                <span
                  className={cn(
                    "font-display font-bold tabular-nums",
                    compact ? "text-sm" : "text-lg",
                    row.pct > 12 ? "text-white" : "text-foreground",
                  )}
                >
                  {revealPercentages && `${row.pct}%`}
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums",
                    row.pct > 78 ? "text-white/90" : "text-muted-foreground",
                  )}
                >
                  {row.count} {row.count === 1 ? "answer" : "answers"}
                </span>
              </div>
            </div>

            {isCorrect && (
              <span className="hidden shrink-0 items-center gap-1 rounded-full bg-success/12 px-2.5 py-1 text-xs font-bold text-success sm:inline-flex">
                ✓ Correct
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
