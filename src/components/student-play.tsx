"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ChoicePicker } from "@/components/choice-picker";
import { TimerRing } from "@/components/timer-ring";
import { QuestionLeaderboard } from "@/components/question-leaderboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useStudentRoom, type StudentPhase } from "@/lib/use-student-room";
import { useRoomChannel } from "@/lib/use-room-channel";
import { useCountdown } from "@/lib/use-countdown";
import { joinRoom, submitAnswer, submitChallenge, rpcError } from "@/lib/rpc";
import { saveSession, type StoredSession } from "@/lib/session";
import { OPTION_LETTERS } from "@/lib/game";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  MessageSquareWarning,
  Trophy,
  Users,
  WifiOff,
  Zap,
} from "lucide-react";

export function StudentPlay({ code }: { code: string }) {
  const { state, session, error, loading, phase, refresh, adopt, forget } =
    useStudentRoom(code);

  const roomId = state?.room.id ?? session?.roomId ?? null;
  const { status: channelStatus } = useRoomChannel({
    roomId,
    kind: "student",
    nickname: session?.nickname,
    enabled: !!roomId,
    onEvent: () => void refresh(),
  });

  if (loading) {
    return (
      <Shell code={code}>
        <Centered>
          <Loader2 className="size-6 animate-spin text-[var(--primary)]" />
          <p className="mt-3 text-muted-foreground">Checking your session…</p>
        </Centered>
      </Shell>
    );
  }

  if (phase === "join" || !session) {
    return (
      <Shell code={code}>
        <NicknameGate
          code={code}
          onJoined={(s) => {
            saveSession(s);
            adopt(s);
          }}
        />
      </Shell>
    );
  }

  if (error && error !== "network_error") {
    return (
      <Shell code={code}>
        <Centered>
          <div className="rounded-2xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/6 p-7 text-center">
            <p className="font-display text-xl font-extrabold">
              {error === "invalid_session" ? "That session expired" : "Connection problem"}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {error === "invalid_session"
                ? "Rejoin with a nickname to get back in."
                : "We'll keep trying. Tap below to reload now."}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  forget();
                }}
              >
                Rejoin
              </Button>
              <Button onClick={() => void refresh()}>Retry</Button>
            </div>
          </div>
        </Centered>
      </Shell>
    );
  }

  return (
    <Shell code={code} nickname={session.nickname} channel={channelStatus}>
      {phase === "loading" || !state ? (
        <Centered>
          <Loader2 className="size-6 animate-spin text-[var(--primary)]" />
          <p className="mt-3 text-muted-foreground">Syncing with the room…</p>
        </Centered>
      ) : (
        <Stage
          phase={phase === "error" ? "lobby" : phase}
          state={state}
          token={session.token}
          onRefresh={refresh}
          onLeave={() => {
            forget();
          }}
        />
      )}
    </Shell>
  );
}

/* ---------------------------------------------------------------- shell --- */

function Shell({
  code,
  nickname,
  channel,
  children,
}: {
  code: string;
  nickname?: string;
  channel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link href="/" aria-label="Home">
            <Logo compact />
          </Link>
          <span className="room-code rounded-lg bg-[var(--primary)] px-2 py-1 text-xs font-bold text-white">
            {code}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {channel && channel !== "subscribed" && (
              <span
                className="flex items-center gap-1 rounded-md bg-[var(--warning)]/15 px-1.5 py-1 text-[10px] font-bold text-[var(--warning)]"
                title="Reconnecting"
              >
                <WifiOff className="size-3" /> reconnecting
              </span>
            )}
            {nickname && (
              <span className="max-w-[40vw] truncate rounded-md bg-muted px-2 py-1 text-xs font-semibold">
                {nickname}
              </span>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-5">{children}</main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid place-items-center py-20 text-center">{children}</div>;
}

/* --------------------------------------------------------------- join ----- */

function NicknameGate({
  code,
  onJoined,
}: {
  code: string;
  onJoined: (s: StoredSession) => void;
}) {
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = nickname.trim();
    if (name.length < 1 || name.length > 24) {
      setMessage("Nicknames are 1–24 characters.");
      return;
    }
    setBusy(true);
    const { data, error } = await joinRoom(code, name);
    setBusy(false);

    if (error) {
      setMessage(
        error === "nickname_taken"
          ? "That nickname is taken in this room — try another."
          : error === "room_not_found"
            ? "That room isn't live. Check the code on the board."
            : error === "network_error"
              ? "Couldn't reach the room. Check your connection and retry."
              : rpcError({ message: error }),
      );
      return;
    }
    if (!data) return;

    onJoined({
      token: data.token,
      roomId: data.room_id,
      roomCode: data.room_code,
      nickname: data.nickname,
      joinedAt: Date.now(),
    });
  }

  return (
    <div className="animate-rise">
      <div className="rounded-3xl border border-border bg-gradient-to-br from-[var(--ember)]/14 via-[var(--gold)]/8 to-transparent p-6 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/70 text-[var(--primary)]">
          <Zap className="size-7" />
        </span>
        <h1 className="font-display mt-4 text-3xl leading-tight font-extrabold">
          You&apos;re in. Pick a name.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This is how the class sees you on the leaderboard. Nothing else is asked
          for — no email, no password.
        </p>
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-4 rounded-3xl border border-border bg-card p-5">
        <div className="grid gap-2">
          <Label htmlFor="nick">Nickname</Label>
          <Input
            id="nick"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setMessage(null);
            }}
            placeholder="e.g. MomentumMike"
            maxLength={24}
            autoComplete="off"
            autoFocus
            aria-invalid={!!message}
            className="h-13 text-lg"
          />
          <p className="text-xs text-muted-foreground">
            {nickname.trim().length}/24 characters
          </p>
          {message && <p className="text-sm text-[var(--destructive)]">{message}</p>}
        </div>

        <Button type="submit" size="lg" className="h-13 text-base" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Join the room <ArrowRight className="size-4" />
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Rejoining after a break? Your nickname is remembered on this device.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- stages ---- */

function Stage({
  phase,
  state,
  token,
  onRefresh,
  onLeave,
}: {
  phase: Exclude<StudentPhase, "join" | "loading" | "error">;
  state: NonNullable<ReturnType<typeof useStudentRoom>["state"]>;
  token: string;
  onRefresh: () => void;
  onLeave: () => void;
}) {
  const activity = state.activity;

  switch (phase) {
    case "lobby":
      return <Lobby state={state} />;
    case "question":
      // Keyed on the activity so a new question always starts with a clean
      // slate — no pick carried over from the previous round.
      return (
        <Question key={activity?.id} state={state} token={token} onRefresh={onRefresh} />
      );
    case "submitted":
      return <Submitted state={state} />;
    case "result":
      return <Result state={state} />;
    case "closed":
      return <Closed onLeave={onLeave} />;
    default:
      return <Lobby state={state} />;
  }
}

/* --------------------------------------------------------------- lobby ---- */

function Lobby({ state }: { state: NonNullable<ReturnType<typeof useStudentRoom>["state"]> }) {
  const waiting = state.room.status === "lobby";
  return (
    <div className="animate-rise grid gap-4">
      <div className="rounded-3xl border border-border bg-card p-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--success)]/12 text-[var(--success)]">
          <CheckCircle2 className="size-6" />
        </span>
        <h1 className="font-display mt-3 text-2xl leading-tight font-extrabold">
          {waiting ? "You're in the lobby" : "Waiting on your teacher"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {waiting
            ? "The next question appears here the second it's launched. Keep this screen open."
            : "Sit tight — a new question is on the way."}
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--ember)]/10 px-3 py-1.5 text-sm font-semibold text-[var(--primary)]">
          <Users className="size-4" /> {state.room.participant_count} joined
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5">
        <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
          In the room
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {state.participants.map((p) => (
            <span
              key={p.id}
              className={`rounded-lg px-2 py-1 text-xs font-medium ${
                p.id === state.me.id
                  ? "bg-[var(--ember)]/15 font-bold text-[var(--primary)]"
                  : p.connected
                    ? "bg-muted text-foreground"
                    : "bg-muted text-muted-foreground opacity-60"
              }`}
            >
              {p.nickname}
              {p.id === state.me.id ? " (you)" : ""}
            </span>
          ))}
        </div>
      </div>

      <YourStats state={state} />
    </div>
  );
}

/* ------------------------------------------------------------- question --- */

function Question({
  state,
  token,
  onRefresh,
}: {
  state: NonNullable<ReturnType<typeof useStudentRoom>["state"]>;
  token: string;
  onRefresh: () => void;
}) {
  const a = state.activity!;
  const remaining = useCountdown(a.deadline, state.server_time_ms);
  const [pick, setPick] = useState<(string | number)[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const numeric = a.type === "numerical";
  const options = a.options ?? [];

  const expired = remaining <= 0;

  if (a.paused) {
    return (
      <Centered>
        <TimerRing seconds={a.timer_seconds} total={a.timer_seconds} size="lg" paused />
        <p className="font-display mt-4 text-2xl font-extrabold">Paused ⏸</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Your teacher stopped the clock. Nothing counts down until they resume —
          stay ready.
        </p>
      </Centered>
    );
  }

  async function send() {
    if (busy) return;
    const answer = numeric ? [text.trim()] : pick;
    if (!answer || (answer.length === 1 && String(answer[0]).trim() === "")) {
      toast.error(numeric ? "Enter a number first" : "Pick an answer first");
      return;
    }
    // `submit_answer` re-checks this server-side, but catching it here means a
    // typo never costs the student a submission.
    if (numeric && !Number.isFinite(Number(String(answer[0]).trim()))) {
      toast.error("Numbers only — the units are already in the question");
      return;
    }
    setBusy(true);
    const { error } = await submitAnswer(token, a.id, answer as (string | number)[]);
    setBusy(false);
    if (error) {
      if (error === "already_answered") {
        toast.info("Already locked in for this one");
        onRefresh();
        return;
      }
      toast.error(
        error === "time_expired"
          ? "Time ran out — next one!"
          : error === "not_accepting_answers"
            ? "The teacher closed this question"
            : error === "network_error"
              ? "No connection — try again"
              : error === "numeric_invalid"
                ? "Numbers only — the units are already in the question"
                : error,
      );
      return;
    }
    toast.success("Answer locked in");
    onRefresh();
  }

  if (expired) {
    return (
      <Centered>
        <TimerRing seconds={0} total={a.timer_seconds} size="lg" />
        <p className="font-display mt-4 text-xl font-extrabold">Time&apos;s up!</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Waiting for your teacher to show the class results…
        </p>
      </Centered>
    );
  }

  return (
    <div className="animate-rise grid gap-4">
      <div className="flex items-start gap-4">
        <TimerRing seconds={remaining} total={a.timer_seconds} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">Q{a.seq}</Badge>
            <Badge variant="outline">{a.type.replace("_", " ")}</Badge>
            {a.topic && <Badge variant="outline">{a.topic}</Badge>}
          </div>
          <p className="font-display mt-2 text-2xl leading-snug font-extrabold break-words">
            {a.prompt}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-4">
        {numeric ? (
          <div className="grid gap-3">
            <Label htmlFor="num">Your answer</Label>
            <Input
              id="num"
              value={text}
              onChange={(e) => setText(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="Type a number"
              className="h-14 text-center text-2xl font-bold tabular-nums"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
            />
            <p className="text-center text-xs text-muted-foreground">
              Numbers only — units are in the question.
            </p>
          </div>
        ) : (
          <ChoicePicker
            type={a.type}
            prompt={a.prompt}
            options={options}
            value={pick}
            onChange={setPick}
            size="lg"
          />
        )}
      </div>

      <Button size="lg" className="h-14 text-lg" disabled={busy} onClick={() => void send()}>
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
        {numeric ? "Lock in my number" : "Lock in my answer"}
      </Button>

      <ChallengeButton token={token} activityId={a.id} />
    </div>
  );
}

/* ------------------------------------------------------------ submitted --- */

function Submitted({
  state,
}: {
  state: NonNullable<ReturnType<typeof useStudentRoom>["state"]>;
}) {
  const a = state.activity!;
  const dist = a.distribution ?? [];
  const total = dist.reduce((s, b) => s + b.count, 0);
  const mine = a.my_response?.answer?.[0];
  const mineIdx = typeof mine === "number" ? mine : Number(mine);

  return (
    <div className="animate-rise grid gap-4">
      <div className="rounded-3xl border border-[var(--success)]/35 bg-[var(--success)]/8 p-5 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--success)] text-white">
          <CheckCircle2 className="size-6" />
        </span>
        <h1 className="font-display mt-3 text-2xl font-extrabold">Answer locked in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {a.state === "answering"
            ? "Others are still deciding. Don't peek at your neighbour."
            : "The class split is coming up — then your teacher reveals."}
        </p>
      </div>

      {total > 0 && (a.options ?? []).length > 0 && (
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="mb-3 text-xs font-bold tracking-widest text-muted-foreground uppercase">
            What the class picked
          </p>
          <ul className="grid gap-2">
            {(a.options ?? []).map((o, i) => {
              const bucket = dist.find((d) => d.key === i)?.count ?? 0;
              const pct = Math.round((bucket / Math.max(total, 1)) * 100);
              const isMine = i === mineIdx;
              return (
                <li key={i} className="flex items-center gap-3">
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-lg font-display text-xs font-extrabold text-white ${
                      isMine ? "bg-[var(--ember)]" : "bg-muted-foreground/70"
                    }`}
                  >
                    {OPTION_LETTERS[i] ?? i + 1}
                  </span>
                  <div className="relative h-9 flex-1 overflow-hidden rounded-lg bg-muted">
                    <div
                      className="absolute inset-y-0 left-0 bg-[var(--option-a)]/60 transition-[width] duration-700"
                      style={{ width: `${pct}%` }}
                    />
                    <span className="relative flex h-9 items-center gap-2 px-3 text-xs font-semibold">
                      <span className="truncate">{o}</span>
                      <span className="ml-auto tabular-nums">{pct}%</span>
                    </span>
                  </div>
                  {isMine && (
                    <span className="shrink-0 text-[10px] font-bold text-[var(--primary)]">
                      YOU
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <YourStats state={state} />
    </div>
  );
}

/* --------------------------------------------------------------- result --- */

function Result({ state }: { state: NonNullable<ReturnType<typeof useStudentRoom>["state"]> }) {
  const a = state.activity!;
  const me = state.me;
  const res = a.my_response;
  const correct = res?.is_correct === true;
  const revealed = a.state === "revealed" || a.state === "leaderboard";
  const numeric = a.type === "numerical";
  const correctValue = a.correct_answer?.[0];
  const mine = res?.answer?.[0];
  const mineIdx = typeof mine === "number" ? mine : Number(mine);

  const isLive = a.state !== "leaderboard";

  return (
    <div className="animate-rise grid gap-4">
      <div
        className={`rounded-3xl border p-6 text-center ${
          res
            ? correct
              ? "border-[var(--success)]/40 bg-[var(--success)]/8"
              : "border-[var(--warning)]/40 bg-[var(--warning)]/8"
            : "border-border bg-card"
        }`}
      >
        <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
          {revealed ? "Result" : "Answer shown"}
        </p>
        <h1 className="font-display mt-1.5 text-3xl font-extrabold">
          {!res
            ? "No answer from you"
            : correct
              ? "Correct!"
              : numeric
                ? "Not this time"
                : "Not quite"}
        </h1>

        {revealed && (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">Correct answer</p>
            <p className="font-display mt-1 text-2xl font-extrabold break-words text-[var(--success)]">
              {numeric
                ? String(correctValue ?? "—")
                : `${OPTION_LETTERS[Number(correctValue)] ?? correctValue} — ${
                    (a.options ?? [])[Number(correctValue)] ?? ""
                  }`}
            </p>
            {!numeric && mineIdx >= 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                You picked {OPTION_LETTERS[mineIdx] ?? mineIdx} —{" "}
                {(a.options ?? [])[mineIdx] ?? mine}
              </p>
            )}
          </div>
        )}

        {revealed && res && (
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Pill label="XP" value={`+${res.xp ?? 0}`} tone="primary" />
            <Pill label="Speed" value={`+${res.speed_bonus ?? 0}`} />
            <Pill label="Streak" value={`${me.streak}🔥`} />
          </div>
        )}
      </div>

      {revealed && a.explanation && (
        <div className="rounded-3xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 p-4">
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Why
          </p>
          <p className="mt-1 text-sm leading-relaxed">{a.explanation}</p>
        </div>
      )}

      {a.state === "leaderboard" && (
        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-[var(--gold)]" />
              <h3 className="font-heading font-bold">This question</h3>
            </div>
            <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
              Q{a.seq}
            </span>
          </div>
          <QuestionLeaderboard
            rows={a.question_leaderboard ?? []}
            highlightId={me.id}
            max={20}
          />
        </div>
      )}

      <YourStats state={state} />

      {isLive && (
        <p className="text-center text-xs text-muted-foreground">
          Waiting for the teacher to move on…
        </p>
      )}
    </div>
  );
}

function Pill({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "muted" | "primary";
}) {
  return (
    <div
      className={`rounded-xl px-2 py-2.5 text-center ${
        tone === "primary" ? "bg-[var(--ember)]/12" : "bg-muted"
      }`}
    >
      <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={`font-display text-lg font-extrabold tabular-nums ${
          tone === "primary" ? "text-[var(--primary)]" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function YourStats({ state }: { state: NonNullable<ReturnType<typeof useStudentRoom>["state"]> }) {
  const me = state.me;
  const acc =
    me.answered_count > 0 ? Math.round((me.correct_count / me.answered_count) * 100) : null;

  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
        You
      </p>
      {/* No session-wide rank here: overall standings stay on the teacher's
          screen until they hit "Final results". */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        <Stat label="XP" value={String(me.xp)} />
        <Stat label="Correct" value={String(me.correct_count)} />
        <Stat label="Streak" value={String(me.streak)} />
        <Stat label="Accuracy" value={acc === null ? "—" : `${acc}%`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted px-1 py-2 text-center">
      <p className="font-display text-lg leading-none font-extrabold tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-[9px] font-bold tracking-wider text-muted-foreground uppercase">
        {label}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- closed ---- */

function Closed({ onLeave }: { onLeave: () => void }) {
  return (
    <Centered>
      <div className="animate-rise w-full rounded-3xl border border-border bg-card p-7">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--gold)]/15 text-[var(--primary)]">
          <Trophy className="size-7" />
        </span>
        <h1 className="font-display mt-4 text-3xl font-extrabold">Class dismissed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This room has closed and the temporary data is gone. Nice work — see you
          next time.
        </p>
        <div className="mt-6 grid gap-2">
          <Button size="lg" onClick={onLeave}>
            Join another room
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </Centered>
  );
}

/* ----------------------------------------------------------- challenge ---- */

function ChallengeButton({ token, activityId }: { token: string; activityId: string }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (body.trim().length < 3) return toast.error("Write a little more");
    setBusy(true);
    const { error } = await submitChallenge(token, activityId, body.trim());
    setBusy(false);
    if (error) return toast.error(error);
    setDone(true);
    setOpen(false);
    setBody("");
    toast.success("Sent to your teacher for review");
  }

  if (done) {
    return (
      <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <CheckCircle2 className="size-3.5 text-[var(--success)]" /> Your challenge was
        sent — approve it and you earn bonus XP.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-[var(--primary)]"
      >
        <MessageSquareWarning className="size-3.5" /> Disagree with this question?
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-extrabold">
              Challenge the question
            </DialogTitle>
            <DialogDescription>
              Explain why it&apos;s wrong or ambiguous. Your teacher reviews it —
              approved challenges earn bonus XP.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="The question says friction is negligible, but…"
            maxLength={400}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Send challenge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
