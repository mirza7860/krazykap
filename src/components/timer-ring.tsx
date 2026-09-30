"use client";

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

  const dims = {
    sm: { box: 64, stroke: 6, text: "text-lg", label: "text-[10px]" },
    md: { box: 112, stroke: 8, text: "text-3xl", label: "text-xs" },
    lg: { box: 176, stroke: 11, text: "text-6xl", label: "text-sm" },
  }[size];

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
            dims.text,
            done ? "text-muted-foreground" : critical ? "text-destructive" : "text-foreground",
          )}
        >
          {paused ? "❚❚" : Math.ceil(seconds)}
        </span>
        {!paused && (
          <span className={cn(dims.label, "font-semibold text-muted-foreground")}>
            seconds
          </span>
        )}
      </div>
    </div>
  );
}
