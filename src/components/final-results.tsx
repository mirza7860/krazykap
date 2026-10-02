"use client";

import { useEffect } from "react";
import { Leaderboard } from "@/components/leaderboard";
import { PodiumView } from "@/components/podium-view";
import { fireCelebration } from "@/lib/confetti";
import type { LeaderboardRow } from "@/lib/types";

/**
 * The end-of-class moment: top-3 podium, then the full session leaderboard.
 *
 * This is the ONLY place the room-wide aggregate is ever shown to the class —
 * during the lesson every screen ranks per question instead. Shared by the
 * teacher's "Final results" dialog and the projector.
 *
 * @param celebrate fire the confetti burst on mount (skip for re-renders).
 */
export function FinalResults({
  leaderboard,
  celebrate = true,
  max = 10,
}: {
  leaderboard: LeaderboardRow[];
  celebrate?: boolean;
  max?: number;
}) {
  useEffect(() => {
    if (celebrate) fireCelebration();
  }, [celebrate]);

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="grid place-items-center rounded-3xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
        <p className="font-display text-xl font-extrabold">No scores to show yet</p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Answers are scored the moment you reveal a question — reveal at least one
          and the podium fills in.
        </p>
      </div>
    );
  }

  return (
    <div className="grid w-full gap-5">
      <div className="text-center">
        <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
          Final results
        </p>
        <h2 className="font-display mt-1 text-3xl font-extrabold sm:text-5xl">
          🏆 Top champions
        </h2>
      </div>

      <PodiumView leaderboard={leaderboard} />

      <div>
        <p className="mb-2 text-xs font-bold tracking-widest text-muted-foreground uppercase">
          Leaderboard
        </p>
        <Leaderboard rows={leaderboard} max={max} />
      </div>
    </div>
  );
}
