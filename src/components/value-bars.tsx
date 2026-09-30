"use client";

import { cn } from "@/lib/utils";
import { OPTION_BG } from "@/lib/game";

export interface ValueBucket {
  label: string;
  count: number;
}

/**
 * Companion to `ResponseBars` for numerical answers (PRD §10).
 *
 * A free-form number has no A/B/C/D slots to fill, so the option-bar component
 * would invent four empty ones and mark a phantom "correct" row. This groups
 * the submitted values instead and ranks them by how often each was chosen —
 * still anonymous until the teacher reveals.
 */
export function ValueBars({
  buckets,
  total,
  compact = false,
}: {
  buckets: ValueBucket[];
  total: number;
  compact?: boolean;
}) {
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

  const denom = Math.max(total, 1);

  return (
    <div className={cn("flex w-full flex-col gap-3", compact ? "gap-2" : "gap-4")}>
      {buckets.map((bucket, i) => {
        const pct = Math.round((bucket.count / denom) * 100);
        const color = OPTION_BG[i % OPTION_BG.length];
        return (
          <div key={bucket.label} className="flex items-center gap-3 sm:gap-4">
            <span
              className={cn(
                "flex shrink-0 items-center justify-center truncate rounded-lg px-2.5 font-mono font-extrabold text-white",
                compact ? "h-7 min-w-9 max-w-24 text-xs" : "h-10 min-w-11 max-w-32 text-sm",
                color,
              )}
            >
              {bucket.label}
            </span>

            <div className="relative h-full min-h-9 flex-1 overflow-hidden rounded-xl bg-muted">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 transition-[width] duration-700 ease-out",
                  color,
                )}
                style={{ width: `${pct}%` }}
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
                    pct > 12 ? "text-white" : "text-foreground",
                  )}
                >
                  {pct}%
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums",
                    pct > 78 ? "text-white/90" : "text-muted-foreground",
                  )}
                >
                  {bucket.count} {bucket.count === 1 ? "answer" : "answers"}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Groups raw submitted values into distribution buckets, most-chosen first.
 * An empty submission keeps its own row rather than vanishing, so the teacher
 * can see that somebody submitted nothing.
 */
export function groupValues(
  rows: Array<{ answer?: (string | number)[] | null }>,
): ValueBucket[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const raw = r.answer?.[0];
    const trimmed = raw === undefined || raw === null ? "" : String(raw).trim();
    const label = trimmed === "" ? "(no answer)" : trimmed;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((x, y) => y.count - x.count || x.label.localeCompare(y.label));
}
