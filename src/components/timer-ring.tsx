"use client";

import { ringClock } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Big classroom clock. Circular ring drains as the deadline approaches. */export function TimerRing({
  seconds,
  total,
  size = "md",
  paused = false,
}: {
  seconds: number;
  total: number;
  size?: "sm" | "md" | "lg";
  paused?: boolean;
}) {
  const safeTotal = total > 0 ? total : 1;
  const pct = Math.min(1, Math.max(0, seconds / safeTotal));
  const critical = seconds <= 5 && seconds > 0;
  const done = seconds <= 0;
  // Clock face for anything past a minute ("1:30 / left"), plain seconds
  // for the short classroom timers ("45 / seconds").
  const clock = ringClock(seconds, total);

  const dims = {
    sm: { box: 64, stroke: 6, text: "text-lg", label: "text-[10px]" },
    md: { box: 112, stroke: 8, text: "text-3xl", label: "text-xs" },
    lg: { box: 176, stroke: 11, text: "text-6xl", label: "text-sm" },
  }[size];

  // A clock face is wider than a bare number — step the type down so
  // "59:59" and "1:00:00" stay inside the ring instead of spilling out.
  const face = clock.big.length;
  const textClass =
    face >= 7
      ? ({ sm: "text-xs", md: "text-lg", lg: "text-3xl" } as const)[size]
      : face >= 5 && size === "lg"
        ? "text-5xl"
        : dims.text;

  const r = (dims.box - dims.stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div
      className={cn(
        "relative shrink-0 select-none",
        critical && !paused && "animate-pulse",
      )}
      style={{ width: dims.box, height: dims.box }}
      role="timer"
      aria-live="off"
    >
      <svg
        width={dims.box}
        height={dims.box}
        className={cn("-rotate-90", paused && "opacity-45")}
      >
        <circle
          cx={dims.box / 2}
          cy={dims.box / 2}
          r={r}
          fill="none"
          strokeWidth={dims.stroke}
          className="stroke-muted"
        />
        <circle
          cx={dims.box / 2}
          cy={dims.box / 2}
          r={r}
          fill="none"
          strokeWidth={dims.stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={cn(
            "transition-[stroke-dashoffset] duration-200 ease-linear",
            done
              ? "stroke-muted-foreground"
              : critical
                ? "stroke-destructive"
                : "stroke-[var(--ember)]",
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "font-display font-extrabold tabular-nums",
            textClass,
            done ? "text-muted-foreground" : critical ? "text-destructive" : "text-foreground",
          )}
        >
          {paused ? "❚❚" : clock.big}
        </span>
        {!paused && (
          <span className={cn(dims.label, "font-semibold text-muted-foreground")}>
            {clock.label}
          </span>
        )}
      </div>
    </div>
  );
}
