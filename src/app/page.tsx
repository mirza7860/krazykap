import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  QrCode,
  Users,
  BarChart3,
  Timer,
  Trophy,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const STEPS = [
  { n: "01", title: "Create a room", body: "One click. You get a 6-character code and a QR built for the smartboard." },
  { n: "02", title: "Class scans", body: "Phones join with a nickname only. No accounts, no app installs, no emails." },
  { n: "03", title: "Launch a challenge", body: "Pick an activity from the Quick Challenge shelf and it appears on every screen." },
  { n: "04", title: "Read the room", body: "Show the distribution, argue the misconception, then reveal the answer." },
];

const FEATURES = [
  { icon: Zap, title: "Quick Challenge", body: "Go from silence to a live question in under 30 seconds. No setup wizard." },
  { icon: BarChart3, title: "Live distribution", body: "See the class split as A/B/C/D bars — before anyone's answer is exposed." },
  { icon: Timer, title: "Speed + accuracy", body: "Correct answers score 100. Early answers earn up to 50 bonus points." },
  { icon: Trophy, title: "Five leaderboards", body: "XP, accuracy, speed, streak and participation — so one student never sweeps." },
  { icon: ShieldCheck, title: "Server-scored", body: "Timestamps, scores and ranks are computed in Postgres. Clients can't cheat." },
  { icon: Sparkles, title: "Room disappears", body: "Temporary data expires with the room. Question banks stay yours." },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      {/* warm ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(245,113,31,0.42), rgba(240,180,41,0.16) 55%, transparent 78%)",
        }}
      />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Teacher login</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/login?mode=signup">Start free</Link>
          </Button>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-5">
        {/* ---------------------------------------------------------- hero */}
        <section className="flex flex-col items-center pt-10 pb-20 text-center sm:pt-16">
          <Badge className="mb-6 border-[var(--ember)]/30 bg-[var(--ember)]/10 text-[var(--primary)]">
            <Users className="size-3.5" /> Built for 60 phones at once
          </Badge>

          <h1 className="font-display text-4xl font-extrabold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Every phone becomes
            <br />
            <span className="bg-gradient-to-r from-[var(--primary)] via-[var(--ember)] to-[var(--gold)] bg-clip-text text-transparent">
              a physics instrument
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Rain of Physics is a live classroom game engine. Create a room, project
            the QR, and turn any lesson into a real-time competition — responses,
            rankings and XP updating as the class thinks out loud.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="h-12 px-7 text-base" asChild>
              <Link href="/login?mode=signup">
                <Zap className="size-4" /> Create a live room
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-7 text-base" asChild>
              <Link href="/join">Join a class</Link>
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Students never create an account — just a temporary nickname.
          </p>
        </section>

        {/* -------------------------------------------------------- steps */}
        <section className="pb-24">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]"
              >
                <span className="font-display text-3xl font-extrabold text-[var(--ember)]/35">
                  {s.n}
                </span>
                <h3 className="mt-2 font-display text-lg font-bold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ----------------------------------------------------- features */}
        <section className="pb-24">
          <div className="mb-8 text-center">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              The critical loop
            </h2>
            <p className="mt-2 text-muted-foreground">
              Create → QR → join → challenge → live graph → discuss → reveal → rank
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-[var(--ember)]/40 hover:shadow-lg"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-[var(--ember)]/12 text-[var(--primary)] transition-colors group-hover:bg-[var(--ember)] group-hover:text-white">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------- CTA */}
        <section className="pb-24">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--primary)] to-[#a63408] px-6 py-14 text-center text-white sm:px-14">
            <QrCode className="mx-auto size-10 opacity-70" />
            <h2 className="mt-5 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Think. Predict. Answer. Compete. Learn.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-white/80">
              Interrupt the lesson at any moment and say: “Let&apos;s see what
              everyone thinks.”
            </p>
            <div className="mt-8 flex justify-center">
              <Button
                size="lg"
                className="h-12 bg-white px-8 text-base text-[var(--primary)] hover:bg-white/90"
                asChild
              >
                <Link href="/login?mode=signup">Open the control centre</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 sm:flex-row">
          <Logo />
          <p className="text-xs text-muted-foreground">
            Live Classroom · ephemeral rooms · server-authoritative scoring
          </p>
        </div>
      </footer>
    </div>
  );
}
