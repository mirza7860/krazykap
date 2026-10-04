"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  clipToWidth,
  downloadCanvas,
  loadImage,
  roundedRectPath,
} from "@/lib/canvas";
import type { LeaderboardRow } from "@/lib/types";

/** Matches `rounded-3xl` on the card the board sits in. */
const PNG_RADIUS = 24;
/** Row pitch on screen: `--board-row-h` + `--board-row-gap` in globals.css. */
const ROW_H = 64;
const ROW_GAP = 8;
const PAD = 24;
/** Everything above the first row: logo strip + the centred title. */
const HEADER_H = 76;
const WIDTH = 760;

const MEDALS = ["🥇", "🥈", "🥉"];
const EMOJI_FONT =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

/**
 * Draw the leaderboard into a canvas and hand it to the browser.
 *
 * Deliberately the same hand-drawn approach as the podium export (see
 * `podium-view.tsx`): every value printed here is the value the row prints on
 * screen — rank, nickname, correct/answered, accuracy, best streak, XP — so
 * the file can never disagree with the board it came from.
 */
export async function downloadLeaderboardPng(rows: LeaderboardRow[]): Promise<void> {
  const list = rows.filter(Boolean);
  if (list.length === 0) return;

  const width = WIDTH;
  const height = HEADER_H + list.length * ROW_H + (list.length - 1) * ROW_GAP + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(2, 2);

  // Await the logo: an onload that fires after `toDataURL` never lands.
  const logo = await loadImage("/kap-logo.webp").catch(() => null);

  ctx.fillStyle = "#fffdfb";
  roundedRectPath(ctx, 0, 0, width, height, PNG_RADIUS);
  ctx.fill();

  if (logo) {
    const logoHeight = 34;
    const ratio = logo.naturalWidth / logo.naturalHeight || 3;
    ctx.drawImage(logo, PAD, 22, logoHeight * ratio, logoHeight);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#221812";
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.fillText("Leaderboard", width / 2, 47);

  list.forEach((row, i) => {
    const x = PAD;
    const w = width - PAD * 2;
    const y = HEADER_H + i * (ROW_H + ROW_GAP);
    const top3 = row.rank <= 3;

    ctx.fillStyle = top3 ? "rgba(240,180,41,0.16)" : "#f8f2ea";
    roundedRectPath(ctx, x, y, w, ROW_H, 16);
    ctx.fill();
    ctx.strokeStyle = top3 ? "rgba(240,180,41,0.55)" : "#eadcce";
    ctx.lineWidth = 1;
    ctx.stroke();

    const badgeCx = x + 34;
    const badgeCy = y + ROW_H / 2;

    if (top3) {
      ctx.textAlign = "center";
      ctx.font = `28px ${EMOJI_FONT}`;
      ctx.fillText(MEDALS[row.rank - 1] ?? String(row.rank), badgeCx, badgeCy + 10);
    } else {
      ctx.fillStyle = "#efe4d7";
      roundedRectPath(ctx, badgeCx - 18, badgeCy - 18, 36, 36, 10);
      ctx.fill();
      ctx.fillStyle = "#7a6552";
      ctx.font = "bold 15px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(row.rank), badgeCx, badgeCy + 1);
      ctx.textBaseline = "alphabetic";
    }

    const textX = x + 64;
    const valueX = x + w - 18;
    const maxText = valueX - textX - 16;

    ctx.textAlign = "left";
    ctx.fillStyle = "#221812";
    ctx.font = "bold 17px system-ui, sans-serif";
    const name = row.team ? `${row.nickname}  [${row.team}]` : row.nickname;
    ctx.fillText(clipToWidth(ctx, name, maxText), textX, y + 27);

    ctx.fillStyle = "#7a6552";
    ctx.font = "13px system-ui, sans-serif";
    const subtitle = `${row.correct_count}/${row.answered_count} correct · ${
      row.accuracy === null ? "—" : `${row.accuracy}%`
    }${row.best_streak > 1 ? ` · best streak ${row.best_streak}` : ""}`;
    ctx.fillText(clipToWidth(ctx, subtitle, maxText), textX, y + 47);

    ctx.textAlign = "right";
    ctx.font = "bold 16px system-ui, sans-serif";
    // Rank 1 reads gold, but the on-screen `--gold` is a projector colour —
    // it disappears on a white PNG, so the export uses its darker sibling.
    ctx.fillStyle = row.rank === 1 ? "#a9750a" : "#221812";
    ctx.fillText(`${row.xp} XP`, valueX, badgeCy + 6);
  });

  downloadCanvas(canvas, "leaderboard.png");
}

/**
 * The download control itself. Renders nothing when there is nothing to
 * export, so an empty board never shows a button that would do nothing.
 */
export function LeaderboardDownload({
  rows,
  max = 10,
  label = "Download Leaderboard PNG",
  className,
}: {
  rows: LeaderboardRow[];
  max?: number;
  label?: string;
  className?: string;
}) {
  const shown = rows.slice(0, max);
  if (shown.length === 0) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("gap-2", className)}
      onClick={() => void downloadLeaderboardPng(shown)}
    >
      <Download className="size-4" /> {label}
    </Button>
  );
}
