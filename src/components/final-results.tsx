"use client";

import { useEffect } from "react";
import { Leaderboard } from "@/components/leaderboard";
import { LeaderboardDownload } from "@/components/leaderboard-download";
import { PodiumView } from "@/components/podium-view";
import { fireCelebration, playCelebrationSound } from "@/lib/confetti";
import type { LeaderboardRow } from "@/lib/types";

/**
 * The end-of-class moment: top-3 podium, then the full session leaderboard.
 *
 * This is the ONLY place the room-wide aggregate is ever shown to the class —
 * during the lesson every screen ranks per question instead. Shared by the
 * teacher's "Final results" dialog and the projector.
 *
 * @param celebrate play the confetti burst and fanfare on mount. Off by
 * default: the show is for the projector, not for the teacher's laptop, so
 * the dialog opts out and only the smartboard celebrates.
 * @param layout "stack" is the teacher's dialog — podium over leaderboard.
 * "split" puts them side by side and takes the height it is given, which is
 * what the projector wants: a poster that fills the screen with no scroll.
 * @param leaderboardRows how many rows the leaderboard can show at once. The
 * list is clamped to exactly that many rows tall and scrolls inside its own
 * box beyond it, so the board never grows into the page around it.
 */
export function FinalResults({
  leaderboard,
  celebrate = false,
  max = 10,
  layout = "stack",
  leaderboardRows = 10,
}: {
  leaderboard: LeaderboardRow[];
  celebrate?: boolean;
  max?: number;
  layout?: "stack" | "split";
  leaderboardRows?: number;
}) {
  useEffect(() => {
    if (!celebrate) return;
    fireCelebration();
    playCelebrationSound();
  }, [celebrate]);

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div
        className={`grid place-items-center rounded-3xl border border-dashed border-border bg-card/60 px-6 py-14 text-center ${
          layout === "split" ? "min-h-0 flex-1" : ""
        }`}
      >
        <p className="font-display text-xl font-extrabold">No scores to show yet</p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Answers are scored the moment you reveal a question — reveal at least one
          and the podium fills in.
        </p>
      </div>
    );
  }

  if (layout === "split") {
    return (
      <div className="grid min-h-0 w-full flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
        <div className="text-center lg:col-span-2">
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Final results
          </p>
          <h2 className="font-display mt-1 text-3xl font-extrabold sm:text-5xl">
            🏆 Top champions
          </h2>
        </div>

        {/* `m-auto` rather than a centering utility: if the podium is ever
            taller than this column the margins collapse to zero and the top
            stays reachable instead of being clipped off a centred scroll. */}
        <div className="no-scrollbar flex min-h-0 flex-col overflow-y-auto">
          <div className="m-auto flex w-full justify-center">
            <PodiumView leaderboard={leaderboard} />
          </div>
        </div>

        {/* No scroll on this column: the list below takes the height it is
            given, clamps itself to `leaderboardRows` and scrolls on its own —
            so the column is either exactly full or has room to spare. */}
        <div className="flex min-h-0 flex-1 flex-col pr-1">
          <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
              Leaderboard
            </p>
            <LeaderboardDownload rows={leaderboard} max={max} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <Leaderboard
              rows={leaderboard}
              max={max}
              viewportRows={leaderboardRows}
            />
          </div>
        </div>
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
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Leaderboard
          </p>
          <LeaderboardDownload rows={leaderboard} max={max} />
        </div>
        <Leaderboard
          rows={leaderboard}
          max={max}
          viewportRows={leaderboardRows}
        />
      </div>
    </div>
  );
}
