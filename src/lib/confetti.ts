"use client";

import confetti from "canvas-confetti";

/** The room's ember palette, so the burst matches the rest of the product. */
const COLORS = ["#db4a0b", "#f5711f", "#f0b429", "#ffffff", "#ffd166"];

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * One celebration for the final results: a wide central burst plus two side
 * cannons for ~1.4s. Respects `prefers-reduced-motion` — those users get the
 * results, just without the particles.
 */
export function fireCelebration(): void {
  if (typeof window === "undefined" || reducedMotion()) return;

  const fire = (origin: { x: number; y: number }) =>
    confetti({
      particleCount: 45,
      angle: 60,
      spread: 70,
      startVelocity: 42,
      origin,
      colors: COLORS,
      disableForReducedMotion: true,
    });

  confetti({
    particleCount: 180,
    spread: 110,
    startVelocity: 48,
    origin: { x: 0.5, y: 0.6 },
    colors: COLORS,
    scalar: 1.05,
    disableForReducedMotion: true,
  });
  fire({ x: 0, y: 0.72 });
  fire({ x: 1, y: 0.72 });

  const end = Date.now() + 1300;
  const frame = () => {
    fire({ x: 0, y: 0.72 });
    fire({ x: 1, y: 0.72 });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
