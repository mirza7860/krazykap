"use client";

import { useRef } from "react";
import type { LeaderboardRow } from "@/lib/types";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Matches `rounded-3xl` on the on-screen podium container. */
const PNG_RADIUS = 24;
/** Matches `rounded-t-2xl` on the on-screen podium steps. */
const STEP_RADIUS = 16;

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: number | [number, number, number, number],
): void {
  ctx.beginPath();
  const anyCtx = ctx as CanvasRenderingContext2D & {
    roundRect?: (
      x: number,
      y: number,
      w: number,
      h: number,
      r: number | number[],
    ) => void;
  };
  if (typeof anyCtx.roundRect === "function") {
    anyCtx.roundRect(x, y, w, h, radii as number[]);
    return;
  }
  const [tl, tr, br, bl] =
    typeof radii === "number"
      ? [radii, radii, radii, radii]
      : radii;
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.lineTo(x + w - tr, y);
  ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

export function PodiumView({ leaderboard }: { leaderboard: LeaderboardRow[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const correctLeaderboard = leaderboard.filter((r) => r.correct_count > 0);

  const first = correctLeaderboard[0];
  const second = correctLeaderboard[1];
  const third = correctLeaderboard[2];

  const handleDownload = async () => {
    if (!containerRef.current) return;
    const node = containerRef.current;

    const width = node.offsetWidth || 600;
    const height = node.offsetHeight || 400;

    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(2, 2);

    // The logo used to be drawn from an onload callback that fired after the
    // export below, so it never made it into the file. Await it first.
    const logo = await loadImage("/kap-logo.webp").catch(() => null);

    // White card, rounded like the on-screen stand. Only the rounded rect is
    // painted, so the corners stay transparent and the PNG matches the UI.
    ctx.fillStyle = "#ffffff";
    roundedRectPath(ctx, 0, 0, width, height, PNG_RADIUS);
    ctx.fill();

    // Branding, top-left, exactly where it sits in the DOM.
    if (logo) {
      const logoHeight = 34;
      const ratio = logo.naturalWidth / logo.naturalHeight || 3;
      ctx.drawImage(logo, 24, 22, logoHeight * ratio, logoHeight);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.fillText("Top Champions", width / 2, 47);

    const stepWidth = Math.min(130, width / 3.5);
    const baseX = width / 2;
    const groundY = height - 40;

    const drawPodium = (
      p: LeaderboardRow | undefined,
      x: number,
      stepHeight: number,
      color: string,
      label: string,
      medal: string,
    ) => {
      // Step box — top-only rounding, same as `rounded-t-2xl` in the DOM.
      ctx.fillStyle = color;
      roundedRectPath(
        ctx,
        x - stepWidth / 2,
        groundY - stepHeight,
        stepWidth,
        stepHeight,
        [STEP_RADIUS, STEP_RADIUS, 0, 0],
      );
      ctx.fill();
      ctx.strokeStyle = "rgba(15, 23, 42, 0.14)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Rank label on the step face.
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px system-ui, sans-serif";
      ctx.fillText(label, x, groundY - stepHeight / 2 + 10);

      if (p) {
        ctx.font = "30px system-ui, sans-serif";
        ctx.fillText(medal, x, groundY - stepHeight - 55);

        ctx.font = "bold 18px system-ui, sans-serif";
        ctx.fillStyle = "#0f172a";
        ctx.fillText(p.nickname, x, groundY - stepHeight - 30);

        ctx.font = "14px system-ui, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.fillText(`${p.xp} XP`, x, groundY - stepHeight - 10);
      } else {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "italic 14px system-ui, sans-serif";
        ctx.fillText("Empty", x, groundY - stepHeight - 15);
      }
    };

    // 2nd Place (Left) · 1st Place (Center) · 3rd Place (Right)
    drawPodium(second, baseX - stepWidth - 15, 120, "#64748b", "2", "🥈");
    drawPodium(first, baseX, 170, "#eab308", "1", "🥇");
    drawPodium(third, baseX + stepWidth + 15, 80, "#b45309", "3", "🥉");

    const link = document.createElement("a");
    link.download = "top_3_champions.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        ref={containerRef}
        className="relative flex min-h-[380px] w-full max-w-2xl items-end justify-center gap-3 rounded-3xl border border-border bg-card p-6 pt-16 shadow-lg sm:gap-6 sm:p-10"
      >
        {/* KAP logo sits on a white chip so the dark artwork stays readable on
            both the light and the dark card. */}
        <div className="absolute top-4 left-6 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-black/5">
          <img
            src="/kap-logo.webp"
            alt="KAP Logo"
            className="h-7 w-auto object-contain"
          />
        </div>

        {/* 2nd Place - Silver (Left Stair) */}
        <div className="flex max-w-[150px] flex-1 flex-col items-center">
          {second ? (
            <div className="mb-3 text-center">
              <span className="text-3xl sm:text-4xl">🥈</span>
              <p className="max-w-[120px] truncate font-display text-sm font-extrabold sm:text-lg">
                {second.nickname}
              </p>
              <p className="text-xs font-semibold text-muted-foreground">
                {second.xp} XP
              </p>
            </div>
          ) : (
            <p className="mb-3 text-xs italic text-muted-foreground">Empty</p>
          )}
          <div className="flex h-32 w-full flex-col items-center justify-center rounded-t-2xl border-2 border-slate-400 bg-slate-500/20 shadow-inner sm:h-40">
            <span className="font-display text-2xl font-black text-slate-300 sm:text-4xl">
              2
            </span>
          </div>
        </div>

        {/* 1st Place - Gold (Center Stair) */}
        <div className="-mt-6 flex max-w-[160px] flex-1 flex-col items-center">
          {first ? (
            <div className="mb-3 text-center">
              <span className="animate-bounce text-4xl sm:text-5xl">🥇</span>
              <p className="max-w-[130px] truncate font-display text-base font-black text-[var(--gold)] sm:text-xl">
                {first.nickname}
              </p>
              <p className="text-xs font-bold text-[var(--gold)]/90 sm:text-sm">
                {first.xp} XP
              </p>
            </div>
          ) : (
            <p className="mb-3 text-xs italic text-muted-foreground">Empty</p>
          )}
          <div className="flex h-44 w-full flex-col items-center justify-center rounded-t-2xl border-2 border-[var(--gold)] bg-[var(--gold)]/25 shadow-2xl sm:h-56">
            <span className="font-display text-4xl font-black text-[var(--gold)] sm:text-6xl">
              1
            </span>
          </div>
        </div>

        {/* 3rd Place - Bronze (Right Stair) */}
        <div className="flex max-w-[150px] flex-1 flex-col items-center">
          {third ? (
            <div className="mb-3 text-center">
              <span className="text-3xl sm:text-4xl">🥉</span>
              <p className="max-w-[120px] truncate font-display text-sm font-extrabold sm:text-lg">
                {third.nickname}
              </p>
              <p className="text-xs font-semibold text-muted-foreground">
                {third.xp} XP
              </p>
            </div>
          ) : (
            <p className="mb-3 text-xs italic text-muted-foreground">Empty</p>
          )}
          <div className="flex h-24 w-full flex-col items-center justify-center rounded-t-2xl border-2 border-amber-700 bg-amber-800/20 shadow-inner sm:h-28">
            <span className="font-display text-2xl font-black text-amber-600 sm:text-4xl">
              3
            </span>
          </div>
        </div>
      </div>

      <Button
        onClick={() => void handleDownload()}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <Download className="size-4" /> Download Podium PNG
      </Button>
    </div>
  );
}
