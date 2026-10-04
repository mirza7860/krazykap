"use client";

/**
 * Hours : minutes : seconds editor for question timers.
 *
 * Digits only (anything else is stripped on entry), minutes/seconds
 * validated 0–59 with the overflow carried over on blur ("75" minutes
 * becomes 1h15m), and the total capped at `max` — the bank's own
 * timer_seconds check (1–3600). Seeds its fields once per mount: bump the
 * component's `key` when the value is changed from outside (a template
 * pick, a reopened dialog) so the visible fields follow.
 */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDuration, secondsToHms } from "@/lib/time";
import { cn } from "@/lib/utils";

const num = (v: string) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
};

export function TimeInput({
  value,
  onValueChange,
  label = "Timer",
  id = "timer",
  max = 3600,
}: {
  /** Total seconds; seeds the three fields when the component mounts. */
  value: number;
  /** Fires with the raw total as the user types, and again on every normalize. */
  onValueChange: (seconds: number) => void;
  label?: string;
  id?: string;
  /** Ceiling in seconds (the schema's timer_seconds check default: 1 hour). */
  max?: number;
}) {
  const seed = secondsToHms(value);
  const [hh, setHh] = useState(String(seed.h));
  const [mm, setMm] = useState(String(seed.m));
  const [ss, setSs] = useState(String(seed.s));

  const total = num(hh) * 3600 + num(mm) * 60 + num(ss);

  const minutesInvalid = num(mm) > 59;
  const secondsInvalid = num(ss) > 59;
  const hoursInvalid = num(hh) * 3600 > max;
  const error = minutesInvalid
    ? "Minutes must be 0–59"
    : secondsInvalid
      ? "Seconds must be 0–59"
      : total < 1
        ? "Set at least 1 second"
        : total > max
          ? `Max ${formatDuration(max)}`
          : null;

  function change(part: "h" | "m" | "s", raw: string) {
    const v = raw.replace(/\D/g, "").slice(0, 2);
    const next = { hh, mm, ss };
    if (part === "h") {
      setHh(v);
      next.hh = v;
    } else if (part === "m") {
      setMm(v);
      next.mm = v;
    } else {
      setSs(v);
      next.ss = v;
    }
    onValueChange(num(next.hh) * 3600 + num(next.mm) * 60 + num(next.ss));
  }

  /** On blur: carry the overflow up ("75" min → 1:15) and clamp to max. */
  function settle() {
    let h = num(hh);
    let m = num(mm);
    let s = num(ss);
    h += Math.floor(m / 60);
    m %= 60;
    m += Math.floor(s / 60);
    s %= 60;
    let sum = h * 3600 + m * 60 + s;
    if (sum > max) sum = max;
    const parts = secondsToHms(sum);
    const hs = String(parts.h);
    const ms = String(parts.m);
    const sStr = String(parts.s);
    setHh(hs);
    setMm(ms);
    setSs(sStr);
    onValueChange(sum);
  }

  const field = (
    part: "h" | "m" | "s",
    caption: string,
    val: string,
    invalid: boolean,
  ) => (
    <div className="min-w-0 flex-1">
      <span className="mb-1 block text-[10px] font-medium text-muted-foreground">
        {caption}
      </span>
      <Input
        id={`${id}-${part}`}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        value={val}
        placeholder="0"
        aria-invalid={invalid || undefined}
        onChange={(e) => change(part, e.currentTarget.value)}
        onBlur={settle}
        className={cn("px-1 text-center tabular-nums", invalid && "border-destructive")}
      />
    </div>
  );

  return (
    <div className="grid gap-2">
      <Label htmlFor={`${id}-h`}>{label}</Label>
      <div className="flex items-end gap-1.5">
        {field("h", "Hours", hh, hoursInvalid)}
        <span className="pb-2.5 text-sm font-semibold text-muted-foreground">:</span>
        {field("m", "Minutes", mm, minutesInvalid)}
        <span className="pb-2.5 text-sm font-semibold text-muted-foreground">:</span>
        {field("s", "Seconds", ss, secondsInvalid)}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
