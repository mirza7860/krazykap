"use client";

import { useEffect, useState } from "react";

/**
 * A countdown that stays honest across network jitter.
 *
 * The server owns every deadline — `deadline` is a timestamptz written by
 * Postgres at launch time. All this hook does is translate that absolute
 * instant into a smooth client-side tick. It never invents or extends time;
 * `serverTimeMs` cancels out this device's clock skew.
 */
export function useCountdown(deadline: string | null, serverTimeMs?: number) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!deadline) return;
    const target = new Date(deadline).getTime();
    if (Number.isNaN(target)) return;

    // Offset between the server clock and this device, measured once each time
    // a new deadline arrives so a wrong device clock can't stretch or shrink
    // the question.
    const skew =
      typeof serverTimeMs === "number" ? serverTimeMs - Date.now() : 0;

    const compute = () =>
      setRemaining(Math.max(0, (target - (Date.now() + skew)) / 1000));

    // First paint lands on the next macrotask rather than blocking the effect,
    // then the interval keeps it smooth.
    const kick = window.setTimeout(compute, 0);
    const id = window.setInterval(compute, 200);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(id);
    };
  }, [deadline, serverTimeMs]);

  // No deadline means no clock — report it directly instead of ticking.
  return deadline ? remaining : 0;
}

/** Progress 0→1 through a timer, for the bar under the clock. */
export function useTimerProgress(launchedAt: string | null, totalSeconds: number) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!launchedAt || totalSeconds <= 0) return;
    const start = new Date(launchedAt).getTime();
    if (Number.isNaN(start)) return;

    const compute = () =>
      setProgress(Math.min(1, Math.max(0, (Date.now() - start) / 1000 / totalSeconds)));

    const kick = window.setTimeout(compute, 0);
    const id = window.setInterval(compute, 250);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(id);
    };
  }, [launchedAt, totalSeconds]);

  return launchedAt && totalSeconds > 0 ? progress : 1;
}

/** Forces re-render on an interval so relative timestamps stay current. */
export function useTicker(intervalMs = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setN((n) => n + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
}

/** "12:04" for >60s, otherwise "7.4" (tenths) — the classroom clock format. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, seconds);
  if (total >= 60) {
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return `${Math.floor(total)}.${Math.floor((total % 1) * 10)}`;
}
