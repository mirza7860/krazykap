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

/* --------------------------------------------------------------- sound --- */

let audioCtx: AudioContext | null = null;
let unlockArmed = false;

/**
 * Browsers only allow an AudioContext to start after a user gesture. The
 * projector is a passive screen — nobody clicks it — so we arm a one-shot
 * unlock on the first pointer/key event anywhere on the page. Call this on
 * mount so the listener is in place long before the fanfare wants to play;
 * if no gesture ever happens the sound is simply skipped and the confetti
 * still fires.
 */
export function primeCelebrationAudio(): void {
  if (unlockArmed || typeof window === "undefined") return;
  unlockArmed = true;
  const unlock = () => {
    getAudioContext();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

type ToneOpts = {
  freq: number;
  start: number;
  dur: number;
  type?: OscillatorType;
  vol: number;
};

function tone(ac: AudioContext, dest: AudioNode, o: ToneOpts): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = o.type ?? "triangle";
  osc.frequency.setValueAtTime(o.freq, o.start);
  gain.gain.setValueAtTime(0.0001, o.start);
  gain.gain.exponentialRampToValueAtTime(o.vol, o.start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, o.start + o.dur);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(o.start);
  osc.stop(o.start + o.dur + 0.05);
}

/**
 * A short generated fanfare for the confetti — a rising major arpeggio that
 * resolves into a held chord. Synthesised rather than shipped as an audio file
 * so there is no asset to license, bundle or preload, and nothing to block on
 * before the projector can play it.
 */
export function playCelebrationSound(): void {
  if (typeof window === "undefined") return;
  primeCelebrationAudio();
  const ac = getAudioContext();
  if (!ac) return;

  const t0 = ac.currentTime + 0.03;
  const master = ac.createGain();
  const compressor = ac.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.ratio.value = 6;
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(0.4, t0 + 0.05);
  master.gain.setValueAtTime(0.4, t0 + 1.1);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
  master.connect(compressor);
  compressor.connect(ac.destination);

  // Rising arpeggio: C5 → E5 → G5 → C6.
  const arpeggio = [523.25, 659.25, 783.99, 1046.5];
  arpeggio.forEach((freq, i) =>
    tone(ac, master, { freq, start: t0 + i * 0.1, dur: 0.5, vol: 0.55 }),
  );

  // Held major chord underneath the tail.
  [523.25, 659.25, 783.99].forEach((freq) =>
    tone(ac, master, {
      freq,
      start: t0 + 0.4,
      dur: 1.7,
      type: "sine",
      vol: 0.3,
    }),
  );

  // Sparkle on top so it reads as a win rather than a plain beep.
  tone(ac, master, { freq: 1567.98, start: t0 + 0.52, dur: 0.55, vol: 0.28 });
  tone(ac, master, { freq: 2093.0, start: t0 + 0.64, dur: 0.7, vol: 0.2 });
}
