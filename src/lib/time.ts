/**
 * Duration formatting and h/m/s conversion shared by every place a question
 * timer appears: the countdown ring (display, phones, admin), the metadata
 * badges, and the hours:minutes:seconds editor.
 *
 * All durations are whole seconds. The bank's own constraint is
 * 1–3600 seconds (see supabase/schema.sql), so "1:00:00" is the ceiling
 * everywhere a timer can be set.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Badge form: 45s, 1m 30s, 2h 5m — short enough for a chip. */
export function formatDuration(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  if (total < 60) return `${total}s`;
  if (total < 3600) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
  }
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * What the countdown ring prints inside its circle, plus the caption under
 * it. Short timers keep the plain "45 / seconds" reading; anything a student
 * would count past a minute switches to a clock face so 90 seconds reads
 * "1:30", not "90".
 */
export function ringClock(remaining: number, total: number): {
  big: string;
  label: string;
} {
  const whole = Math.max(0, Math.ceil(remaining));
  if (total < 60) return { big: String(whole), label: "seconds" };
  if (whole >= 3600) {
    return {
      big: `${Math.floor(whole / 3600)}:${pad(Math.floor((whole % 3600) / 60))}:${pad(whole % 60)}`,
      label: "left",
    };
  }
  return { big: `${Math.floor(whole / 60)}:${pad(whole % 60)}`, label: "left" };
}

/** Split seconds into the three fields of the time editor. */
export function secondsToHms(totalSeconds: number): { h: number; m: number; s: number } {
  const total = Math.max(0, Math.round(totalSeconds));
  return {
    h: Math.floor(total / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}
