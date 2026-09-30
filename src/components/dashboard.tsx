"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase, createRoom, rpcError } from "@/lib/rpc";
import { saveLastRoom } from "@/lib/session";
import { DIFFICULTIES, QUICK_TEMPLATES } from "@/lib/game";
import type { Difficulty } from "@/lib/types";
import { toast } from "sonner";
import {
  Plus,
  LogOut,
  Zap,
  BookOpen,
  Loader2,
  Clock,
} from "lucide-react";

interface QuestionRow {
  id: string;
  prompt: string;
  type: string;
  difficulty: Difficulty;
  options: string[];
  correct_answer: (string | number)[];
  explanation: string | null;
  timer_seconds: number;
  topic_id: string | null;
}

interface TopicRow {
  id: string;
  name: string;
}

export function Dashboard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  interface PastRoomRow {
    id: string;
    code: string;
    title: string;
    status: string;
    rounds_total: number;
    created_at: string;
    closed_at: string | null;
  }

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [pastRooms, setPastRooms] = useState<PastRoomRow[]>([]);
  const [loadingQs, setLoadingQs] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    void loadBank();
  }, []);

  async function loadBank() {
    setLoadingQs(true);
    const [q, t, r] = await Promise.all([
      supabase
        .from("questions")
        .select("id,prompt,type,difficulty,options,correct_answer,explanation,timer_seconds,topic_id")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("topics").select("id,name").order("name"),
      supabase
        .from("rooms")
        .select("id,code,title,status,rounds_total,created_at,closed_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (q.data) setQuestions(q.data as QuestionRow[]);
    if (t.data) setTopics(t.data as TopicRow[]);
    if (r.data) setPastRooms(r.data as PastRoomRow[]);
    setLoadingQs(false);
  }

  const startRoom = useCallback(
    async (roomTitle: string) => {
      setCreating(true);
      try {
        const { data, error } = await createRoom(roomTitle || "Live Class");
        if (error || !data) throw new Error(error ?? "room_not_found");
        saveLastRoom(data.id, data.code);
        toast.success(`Room ${data.code} is live`);
        router.push(`/room/${data.code}`);
      } catch (err) {
        toast.error(rpcError({ message: err instanceof Error ? err.message : "" }));
      } finally {
        setCreating(false);
      }
    },
    [router],
  );

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        {/* ------------------------------------------------ create room */}
        <Card className="border-[var(--ember)]/30 bg-gradient-to-br from-card to-[var(--ember)]/5">
          <CardHeader>
            <CardTitle className="font-display text-2xl font-extrabold">
              Start a live room
            </CardTitle>
            <CardDescription>
              You&apos;ll get a 6-character code and a smartboard-ready QR. Students
              join with a nickname only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                void startRoom(title);
              }}
            >
              <div className="flex-1">
                <Label htmlFor="room-title" className="sr-only">
                  Room title
                </Label>
                <Input
                  id="room-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Period 4 · Current Electricity"
                  className="h-11"
                />
              </div>
              <Button type="submit" disabled={creating} className="h-11 px-6">
                {creating ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
                Create room
              </Button>
            </form>
          </CardContent>
        </Card>

        <Separator className="my-8" />

        {/* ------------------------------------------------- quick start */}
        <section className="mb-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-extrabold">Quick Challenge</h2>
              <p className="text-sm text-muted-foreground">
                Pick an activity type now — you can write the question once the room is open.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_TEMPLATES.map((t) => (
              <button
                key={t.type}
                type="button"
                disabled={creating}
                onClick={() => void startRoom(title)}
                className="group rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--ember)]/50 hover:shadow-md disabled:opacity-60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-base font-bold">{t.label}</span>
                  <Badge
                    variant={t.tier === "must" ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {t.tier === "must" ? "core" : "mode"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t.blurb}</p>
              </button>
            ))}
          </div>
        </section>

        <Separator className="my-8" />

        {/* ----------------------------------------------- room history */}
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="flex items-center gap-2 font-display text-xl font-extrabold">
              <Clock className="size-5 text-[var(--primary)]" /> Room History
            </h2>
            <p className="text-sm text-muted-foreground">
              Past classroom sessions saved for your reference.
            </p>
          </div>

          {pastRooms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
              No previous room history yet.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pastRooms.map((r) => (
                <div key={r.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-base font-bold">{r.title}</span>
                    <Badge variant={r.status === "active" ? "default" : "secondary"}>
                      {r.status}
                    </Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">Code: {r.code}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {r.rounds_total} question{r.rounds_total === 1 ? "" : "s"} launched
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(r.created_at).toLocaleDateString()} at{" "}
                    {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <Separator className="my-8" />

        {/* ----------------------------------------------- question bank */}
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-display text-xl font-extrabold">
                <BookOpen className="size-5 text-[var(--primary)]" /> Question bank
              </h2>
              <p className="text-sm text-muted-foreground">
                Persistent and separate from the temporary room data.
              </p>
            </div>
            <Button onClick={() => setBuilderOpen(true)}>
              <Plus className="size-4" /> New question
            </Button>
          </div>

          {loadingQs ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading bank…
            </div>
          ) : questions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
              <p className="font-display text-lg font-bold">No saved questions yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Save a question once and you can relaunch it next class. Rooms are
                temporary — your bank isn&apos;t.
              </p>
              <Button className="mt-5" onClick={() => setBuilderOpen(true)}>
                <Plus className="size-4" /> Create your first question
              </Button>
            </div>
          ) : (
            <ul className="grid gap-3">
              {questions.map((q) => (
                <li
                  key={q.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium break-words">{q.prompt}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline">{q.type.replace("_", " ")}</Badge>
                        <Badge variant="outline">{q.difficulty}</Badge>
                        <Badge variant="outline">
                          <Clock className="size-3" /> {q.timer_seconds}s
                        </Badge>
                        {topics
                          .filter((t) => t.id === q.topic_id)
                          .map((t) => (
                            <Badge key={t.id} variant="secondary">
                              {t.name}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <QuestionBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        topics={topics}
        onSaved={() => {
          setBuilderOpen(false);
          void loadBank();
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function QuestionBuilder({
  open,
  onOpenChange,
  topics,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  topics: TopicRow[];
  onSaved: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState("mcq");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctIdx, setCorrectIdx] = useState(0);
  const [numeric, setNumeric] = useState("");
  const [tolerance, setTolerance] = useState("0");
  const [explanation, setExplanation] = useState("");
  const [timer, setTimer] = useState(30);
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [topicId, setTopicId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setPrompt("");
    setOptions(["", "", "", ""]);
    setCorrectIdx(0);
    setNumeric("");
    setTolerance("0");
    setExplanation("");
    setTimer(30);
    setDifficulty("Medium");
    setTopicId("");
    setType("mcq");
  };

  async function save() {
    if (!prompt.trim()) {
      toast.error("Write the question first");
      return;
    }
    if (type !== "numerical" && options.filter((o) => o.trim()).length < 2) {
      toast.error("Add at least two options");
      return;
    }
    setBusy(true);
    try {
      const clean = options.map((o) => o.trim()).filter(Boolean);
      const body =
        type === "numerical"
          ? { correct_answer: [numeric, tolerance], options: [] }
          : { correct_answer: [correctIdx], options: clean };

      const { error } = await supabase.from("questions").insert({
        prompt: prompt.trim(),
        type,
        options: body.options,
        correct_answer: body.correct_answer,
        explanation: explanation.trim() || null,
        timer_seconds: timer,
        difficulty,
        topic_id: topicId || null,
      });
      if (error) throw new Error(error.message);
      toast.success("Saved to your bank");
      reset();
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-extrabold">
            New question
          </DialogTitle>
          <DialogDescription>
            Saved to your persistent bank — rooms expire, this doesn&apos;t.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="q-prompt">Question</Label>
            <Input
              id="q-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A wire carries current I…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => v && setType(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">MCQ</SelectItem>
                  <SelectItem value="true_false">True / False</SelectItem>
                  <SelectItem value="prediction">Prediction</SelectItem>
                  <SelectItem value="numerical">Numerical</SelectItem>
                  <SelectItem value="find_error">Find the Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === "numerical" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="q-num">Correct value</Label>
                <Input
                  id="q-num"
                  value={numeric}
                  onChange={(e) => setNumeric(e.target.value)}
                  placeholder="9.8"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="q-tol">Tolerance (±)</Label>
                <Input
                  id="q-tol"
                  value={tolerance}
                  onChange={(e) => setTolerance(e.target.value)}
                  placeholder="0.1"
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label>Options &amp; correct answer</Label>
              <div className="grid gap-2">
                {(type === "true_false" ? ["True", "False"] : options).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct"
                      checked={correctIdx === i}
                      onChange={() => setCorrectIdx(i)}
                      className="size-4 accent-[var(--primary)]"
                      aria-label={`Mark option ${i + 1} correct`}
                    />
                    <Input
                      value={opt}
                      disabled={type === "true_false"}
                      onChange={(e) => {
                        const next = [...options];
                        next[i] = e.target.value;
                        setOptions(next);
                      }}
                      placeholder={`Option ${i + 1}`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Select the radio button beside the correct option.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Timer</Label>
              <Select value={String(timer)} onValueChange={(v) => setTimer(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 30, 45, 60, 90].map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s}s
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Topic</Label>
              <Select value={topicId} onValueChange={(v) => setTopicId(v ?? "none")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="q-exp">Explanation (shown after reveal)</Label>
            <Input
              id="q-exp"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Why the wrong answers are tempting…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Save question
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
