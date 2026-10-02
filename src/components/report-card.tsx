"use client";

import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import type { Participant, SessionSummary, StudentReportRow } from "@/lib/types";

/**
 * Report card rows straight out of `get_session_summary`.
 *
 * That function is SQL, so a teacher who has not re-run `supabase/schema.sql`
 * yet gets a response without a `report` key. We can still rebuild the card in
 * the live room from the participants we already hold — everyone's XP, correct
 * and answered counts ship in `get_teacher_state`.
 */
export function summaryWithReport(
  summary: SessionSummary | null,
  participants: Participant[],
): SessionSummary | null {
  if (!summary || summary.report) return summary;
  const total = summary.questions;
  const report = participants
    .map((p) => {
      const answered = p.answered_count ?? 0;
      const correct = p.correct_count ?? 0;
      return {
        id: p.id,
        nickname: p.nickname,
        xp: p.xp ?? 0,
        answered,
        correct,
        wrong: Math.max(0, answered - correct),
        unattempted: Math.max(0, total - answered),
      };
    })
    .sort(
      (a, b) =>
        b.xp - a.xp ||
        b.correct - a.correct ||
        a.nickname.localeCompare(b.nickname),
    );
  return { ...summary, report };
}

/**
 * Session report card: every student who joined, whether they scored or not.
 *
 * Deliberately not the leaderboard — `public.leaderboard()` caps at ten rows
 * and filters out anyone with `correct_count > 0`, which is exactly the wrong
 * shape for a record of who was in the room. This is the roll call: answered,
 * wrong, correct, unattempted, XP.
 */
export function ReportCard({
  rows,
  questions,
}: {
  rows: StudentReportRow[] | undefined;
  questions: number;
}) {
  if (rows === undefined) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border px-6 py-10 text-center">
        <p className="font-display text-base font-bold">Report card not built yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Re-run <code className="font-mono text-xs">supabase/schema.sql</code> in
          the Supabase SQL Editor — it is safe to run again — and every student in
          the room gets a row here.
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border px-6 py-10 text-center">
        <p className="font-display text-base font-bold">Nobody joined yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The report card fills in as soon as a student scans in.
        </p>
      </div>
    );
  }

  const totals = rows.reduce(
    (acc, r) => ({
      xp: acc.xp + (r.xp ?? 0),
      answered: acc.answered + (r.answered ?? 0),
      correct: acc.correct + (r.correct ?? 0),
      wrong: acc.wrong + (r.wrong ?? 0),
      unattempted: acc.unattempted + (r.unattempted ?? 0),
    }),
    { xp: 0, answered: 0, correct: 0, wrong: 0, unattempted: 0 },
  );

  const num = "px-2 py-2 text-right font-semibold tabular-nums";

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/50 px-3 py-2">
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
          Report card
        </p>
        <p className="text-[10px] font-semibold text-muted-foreground">
          {rows.length} student{rows.length === 1 ? "" : "s"} ·{" "}
          {questions} question{questions === 1 ? "" : "s"}
        </p>
      </div>

      <div className="max-h-[340px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
              <th className="px-3 py-2 text-left">Student</th>
              <th className="px-2 py-2 text-right">XP</th>
              <th className="px-2 py-2 text-right">Answered</th>
              <th className="px-2 py-2 text-right">Correct</th>
              <th className="px-2 py-2 text-right">Wrong</th>
              <th className="px-3 py-2 text-right">Unattempted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/70">
                <td className="max-w-[180px] px-3 py-2">
                  <span className="truncate font-semibold">{r.nickname}</span>
                </td>
                <td className={`${num} text-[var(--primary)]`}>{r.xp ?? 0}</td>
                <td className={`${num} text-muted-foreground`}>
                  {r.answered ?? 0}
                </td>
                <td className={`${num} text-success`}>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="size-3.5 shrink-0" />
                    {r.correct ?? 0}
                  </span>
                </td>
                <td className={`${num} text-destructive`}>
                  <span className="inline-flex items-center gap-1">
                    <XCircle className="size-3.5 shrink-0" />
                    {r.wrong ?? 0}
                  </span>
                </td>
                <td className={`${num} text-muted-foreground`}>
                  <span className="inline-flex items-center gap-1">
                    <MinusCircle className="size-3.5 shrink-0" />
                    {r.unattempted ?? 0}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/50 text-xs font-bold">
              <td className="px-3 py-2 uppercase tracking-wide">
                Class total
              </td>
              <td className={`${num} text-[var(--primary)]`}>{totals.xp}</td>
              <td className={num}>{totals.answered}</td>
              <td className={`${num} text-success`}>{totals.correct}</td>
              <td className={`${num} text-destructive`}>{totals.wrong}</td>
              <td className={`${num} text-muted-foreground`}>
                {totals.unattempted}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
