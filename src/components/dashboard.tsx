"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { supabase, createRoom, getSessionSummary, rpcError } from "@/lib/rpc";
import { saveLastRoom } from "@/lib/session";
import { fetchModules, MODULE_PAGE } from "@/lib/bank";
import { DIFFICULTIES, QUICK_TEMPLATES } from "@/lib/game";
import type { Difficulty, SessionSummary } from "@/lib/types";
import { PodiumView } from "@/components/podium-view";
import { ReportCard } from "@/components/report-card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  QuestionBank,
  type BankQuestion,
  type QuestionModule,
} from "@/components/question-bank";
import { toast } from "sonner";
import {
  Plus,
  LogOut,
  Zap,
  BookOpen,
  Loader2,
  Clock,
  BarChart3,
  Monitor,
  Radio,
  LayoutDashboard,
  Layers,
  Sparkles,
  Upload,
  Search,
  ArrowRight,
  Users,
  Trash,
} from "lucide-react";

interface TopicRow {
  id: string;
  name: string;
}

interface PastRoomRow {
  id: string;
  code: string;
  title: string;
  status: string;
  rounds_total: number;
  created_at: string;
  closed_at: string | null;
}

type View = "overview" | "questions" | "sessions";

const SESSION_PAGE = 12;

/** PostgREST filter syntax treats these as control characters. */
function sanitize(term: string) {
  return term.replace(/[%,()]/g, " ").trim();
}

export function Dashboard() {
  const router = useRouter();
  const [view, setView] = useState<View>("overview");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  // ------------------------------------------------------------- the bank
  const [modules, setModules] = useState<QuestionModule[]>([]);
  const [moduleTotal, setModuleTotal] = useState(0);
  const [moduleSearch, setModuleSearch] = useState("");
  const [moduleTerm, setModuleTerm] = useState("");
  const [moduleMore, setModuleMore] = useState(false);
  const [loadingMoreModules, setLoadingMoreModules] = useState(false);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [questionTotal, setQuestionTotal] = useState(0);
  const [loadingModules, setLoadingModules] = useState(true);
  // Bumped after every save or delete, so every page of the bank is re-read.
  const [bankVersion, setBankVersion] = useState(0);

  // -------------------------------------------------------------- numbers
  const [stats, setStats] = useState({ sessions: 0, students: 0, live: 0 });

  // ------------------------------------------------------------- sessions
  const [sessions, setSessions] = useState<PastRoomRow[]>([]);
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessionTerm, setSessionTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "ended">("all");
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsMore, setSessionsMore] = useState(false);
  // Deleting a session is irreversible, so it always goes through a confirm.
  const [sessionToDelete, setSessionToDelete] = useState<PastRoomRow | null>(null);
  const [sessionConfirmOpen, setSessionConfirmOpen] = useState(false);
  const [deletingSession, setDeletingSession] = useState(false);

  // --------------------------------------------------------------- modals
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderModule, setBuilderModule] = useState("");
  // Remounts the builder on every open: fresh fields, module seeded.
  const [builderSeq, setBuilderSeq] = useState(0);
  // Set while the builder is editing an existing question rather than adding one.
  const [editingQuestion, setEditingQuestion] = useState<BankQuestion | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedHistoryRoom, setSelectedHistoryRoom] = useState<PastRoomRow | null>(null);
  const [historySummary, setHistorySummary] = useState<SessionSummary | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function openRoomHistory(r: PastRoomRow) {
    setSelectedHistoryRoom(r);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    const { data } = await getSessionSummary(r.id);
    if (data) setHistorySummary(data as SessionSummary);
    setLoadingHistory(false);
  }

  /**
   * One page of modules at a time, grouped inside the database by
   * `question_modules`. The list itself is paged (MODULE_PAGE), so a bank of
   * 100 modules × 100 questions costs 24 short rows up front instead of
   * reading every question to work out what exists.
   */
  const loadModules = useCallback(
    async (offset: number, append: boolean, search: string) => {
      if (append) setLoadingMoreModules(true);
      else setLoadingModules(true);
      try {
        const { rows, total } = await fetchModules(
          search,
          MODULE_PAGE,
          offset,
          String(bankVersion),
        );
        setModules((prev) => (append ? [...prev, ...rows] : rows));
        if (total !== null) setModuleTotal(total);
        setModuleMore(rows.length === MODULE_PAGE);
      } finally {
        setLoadingModules(false);
        setLoadingMoreModules(false);
      }
    },
    [bankVersion],
  );

  /** Any save or delete anywhere in the bank re-reads its first page. */
  const refreshBank = useCallback(() => setBankVersion((v) => v + 1), []);

  const loadStats = useCallback(async () => {
    const [rooms, students, live] = await Promise.all([
      supabase.from("rooms").select("id", { count: "exact", head: true }),
      supabase.from("participants").select("id", { count: "exact", head: true }),
      supabase
        .from("rooms")
        .select("id", { count: "exact", head: true })
        .in("status", ["lobby", "active"]),
    ]);
    setStats({
      sessions: rooms.count ?? 0,
      students: students.count ?? 0,
      live: live.count ?? 0,
    });
  }, []);

  const fetchSessions = useCallback(async (offset: number, term: string, status: string) => {
    let q = supabase
      .from("rooms")
      .select("id,code,title,status,rounds_total,created_at,closed_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + SESSION_PAGE - 1);

    if (term) q = q.or(`title.ilike.%${term}%,code.ilike.%${term}%`);
    if (status === "live") q = q.in("status", ["lobby", "active"]);
    if (status === "ended") q = q.in("status", ["closed", "expired"]);

    const { data } = await q;
    return (data ?? []) as PastRoomRow[];
  }, []);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    void (async () => {
      await loadStats();
    })();
  }, [loadStats]);

  // Debounce the module filter, then page the list again from the top.
  useEffect(() => {
    const t = setTimeout(() => setModuleTerm(moduleSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [moduleSearch]);

  // First page of modules — re-read whenever the bank changes or the filter
  // moves. The rest only arrives through "Load more modules".
  useEffect(() => {
    void (async () => {
      await loadModules(0, false, moduleTerm);
    })();
  }, [loadModules, moduleTerm]);

  // Question count: one head-count, never the rows themselves.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { count } = await supabase
        .from("questions")
        .select("id", { count: "exact", head: true });
      if (!cancelled) setQuestionTotal(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [bankVersion]);

  async function loadMoreModules() {
    await loadModules(modules.length, true, moduleTerm);
  }

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("topics").select("id,name").order("name");
      if (data) setTopics(data as TopicRow[]);
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSessionTerm(sanitize(sessionQuery)), 300);
    return () => clearTimeout(t);
  }, [sessionQuery]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingSessions(true);
      const data = await fetchSessions(0, sessionTerm, statusFilter);
      if (cancelled) return;
      setSessions(data);
      setSessionsMore(data.length === SESSION_PAGE);
      setLoadingSessions(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchSessions, sessionTerm, statusFilter]);

  async function loadMoreSessions() {
    setLoadingSessions(true);
    const data = await fetchSessions(sessions.length, sessionTerm, statusFilter);
    setSessions((s) => [...s, ...data]);
    setSessionsMore(data.length === SESSION_PAGE);
    setLoadingSessions(false);
  }

  /**
   * Deleting a room removes the room, its participants, answers and activities
   * (all `on delete cascade`) and nothing in the bank. Live rooms are allowed
   * through deliberately — a teacher who needs the room gone needs it gone.
   */
  async function deleteSession() {
    const room = sessionToDelete;
    if (!room || deletingSession) return;
    setDeletingSession(true);
    try {
      const { error } = await supabase.from("rooms").delete().eq("id", room.id);
      if (error) throw new Error(error.message);
      setSessions((prev) => prev.filter((s) => s.id !== room.id));
      setSessionConfirmOpen(false);
      toast.success(`Deleted ${room.title}`);
      void loadStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete that session");
    } finally {
      setDeletingSession(false);
    }
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

  /** View switch that also drops bank filters typed on the previous screen. */
  function goTo(next: View) {
    setView(next);
    if (next !== "questions") setModuleSearch("");
  }

  function newQuestion(moduleName: string | null) {
    setEditingQuestion(null);
    setBuilderModule(moduleName ?? "");
    setBuilderSeq((n) => n + 1);
    setBuilderOpen(true);
  }

  /** Opens the same builder pre-filled with a saved question, in place. */
  function editQuestion(q: BankQuestion) {
    setEditingQuestion(q);
    setBuilderModule(q.set_name ?? "");
    setBuilderSeq((n) => n + 1);
    setBuilderOpen(true);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const namedModules = useMemo(() => modules.filter((m) => m.name !== null), [modules]);

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

      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-8 lg:py-8">
        <nav
          aria-label="Dashboard"
          className="flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-8 lg:h-fit lg:flex-col lg:overflow-visible lg:pb-0"
        >
          <NavButton
            active={view === "overview"}
            icon={<LayoutDashboard className="size-4" />}
            label="Overview"
            onClick={() => goTo("overview")}
          />
          <NavButton
            active={view === "questions"}
            icon={<BookOpen className="size-4" />}
            label="Question bank"
            badge={questionTotal || undefined}
            onClick={() => goTo("questions")}
          />
          <NavButton
            active={view === "sessions"}
            icon={<Clock className="size-4" />}
            label="Sessions"
            badge={stats.live > 0 ? stats.live : undefined}
            onClick={() => goTo("sessions")}
          />
        </nav>

        <main className="min-w-0">
          {view === "overview" && (
            <div className="grid gap-6">
              {/* ------------------------------------------- start a room */}
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
                <CardContent className="grid gap-5">
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
                      {creating ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Zap className="size-4" />
                      )}
                      Create room
                    </Button>
                  </form>

                  <div className="grid gap-2">
                    <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                      Or jump straight in with
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_TEMPLATES.map((t) => (
                        <button
                          key={t.type}
                          type="button"
                          disabled={creating}
                          title={t.blurb}
                          onClick={() => void startRoom(title)}
                          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold transition-colors hover:border-[var(--ember)]/50 hover:text-[var(--primary)] disabled:opacity-60"
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ------------------------------------------ quick actions */}
              <div className="grid gap-3 sm:grid-cols-3">
                <QuickAction
                  icon={<Plus className="size-4" />}
                  title="New question"
                  blurb="Write one into the bank"
                  onClick={() => newQuestion(null)}
                />
                <QuickAction
                  icon={<Upload className="size-4" />}
                  title="Import JSON set"
                  blurb="Paste an AI-generated set"
                  onClick={() => setImportOpen(true)}
                />
                <QuickAction
                  icon={<Sparkles className="size-4" />}
                  title="AI prompt guide"
                  blurb="The master prompt for ChatGPT"
                  onClick={() => setGuideOpen(true)}
                />
              </div>

              {/* ------------------------------------------------ numbers */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Questions"
                  value={questionTotal}
                  icon={<BookOpen className="size-4" />}
                  onClick={() => goTo("questions")}
                />
                <StatCard
                  label="Modules"
                  value={moduleTotal}
                  icon={<Layers className="size-4" />}
                  onClick={() => goTo("questions")}
                />
                <StatCard
                  label="Sessions"
                  value={stats.sessions}
                  icon={<BarChart3 className="size-4" />}
                  onClick={() => goTo("sessions")}
                />
                <StatCard
                  label="Students reached"
                  value={stats.students}
                  icon={<Users className="size-4" />}
                />
              </div>

              {stats.live > 0 && (
                <button
                  type="button"
                  onClick={() => goTo("sessions")}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--ember)]/40 bg-[var(--ember)]/8 p-4 text-left transition-colors hover:bg-[var(--ember)]/12"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--ember)]/15 text-[var(--primary)]">
                    <Radio className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-sm font-bold">
                      {stats.live} room{stats.live === 1 ? "" : "s"} still live
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Reopen it, or put the projector into display mode.
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </button>
              )}

              {/* ------------------------------------------------ modules */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display text-base font-bold">
                    <Layers className="size-4 text-[var(--primary)]" /> Your modules
                  </CardTitle>
                  <CardDescription>
                    {moduleTotal === 0
                      ? "Name a module when you save a question and it shows up here."
                      : "The sets your question paper teaches from."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingModules ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> Reading your bank…
                    </div>
                  ) : moduleTotal === 0 ? (
                    <Button variant="outline" onClick={() => newQuestion(null)}>
                      <Plus className="size-4" /> Create your first module
                    </Button>
                  ) : (
                    <ul className="grid gap-2">
                      {namedModules.slice(0, 5).map((m) => (
                        <li key={m.name}>
                          <button
                            type="button"
                            onClick={() => goTo("questions")}
                            className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-[var(--ember)]/50"
                          >
                            <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
                            <Badge variant="secondary">{m.count}</Badge>
                          </button>
                        </li>
                      ))}
                      {moduleTotal > 5 && (
                        <li>
                          <Button variant="ghost" size="sm" onClick={() => goTo("questions")}>
                            {moduleTotal - 5} more module{moduleTotal - 5 === 1 ? "" : "s"}
                            <ArrowRight className="size-3" />
                          </Button>
                        </li>
                      )}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {/* ---------------------------------------- recent sessions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display text-base font-bold">
                    <Clock className="size-4 text-[var(--primary)]" /> Recent sessions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingSessions ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> Loading…
                    </div>
                  ) : sessions.length === 0 ? (
                    <p className="py-2 text-sm text-muted-foreground">
                      No sessions yet — your first room will show up here.
                    </p>
                  ) : (
                    <ul className="grid gap-2">
                      {sessions.slice(0, 4).map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => void openRoomHistory(r)}
                            className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-[var(--ember)]/50"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{r.title}</span>
                              <span className="text-xs text-muted-foreground">
                                <span className="font-mono">{r.code}</span> · {r.rounds_total}{" "}
                                question{r.rounds_total === 1 ? "" : "s"} ·{" "}
                                {new Date(r.created_at).toLocaleDateString()}
                              </span>
                            </span>
                            <RoomStatusBadge status={r.status} />
                          </button>
                        </li>
                      ))}
                      <li>
                        <Button variant="ghost" size="sm" onClick={() => goTo("sessions")}>
                          All sessions <ArrowRight className="size-3" />
                        </Button>
                      </li>
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {view === "questions" && (
            <QuestionBank
              modules={modules}
              moduleTotal={moduleTotal}
              moduleSearch={moduleSearch}
              moduleMore={moduleMore}
              loadingModules={loadingModules}
              loadingMoreModules={loadingMoreModules}
              onModuleSearch={setModuleSearch}
              onLoadMoreModules={() => void loadMoreModules()}
              total={questionTotal}
              version={bankVersion}
              onChanged={refreshBank}
              onNewQuestion={newQuestion}
              onEditQuestion={editQuestion}
              onImport={() => setImportOpen(true)}
              onGuide={() => setGuideOpen(true)}
            />
          )}

          {view === "sessions" && (
            <div className="grid gap-5">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display text-lg font-extrabold">
                    <Clock className="size-5 text-[var(--primary)]" /> Room history
                  </CardTitle>
                  <CardDescription>
                    Every class you have run, with the full report card for each.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={sessionQuery}
                      onChange={(e) => setSessionQuery(e.target.value)}
                      placeholder="Search by title or room code…"
                      className="h-10 pl-9"
                      aria-label="Search sessions"
                    />
                  </div>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter((v ?? "all") as typeof statusFilter)}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sessions</SelectItem>
                      <SelectItem value="live">Live now</SelectItem>
                      <SelectItem value="ended">Ended</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {loadingSessions && sessions.length === 0 ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading sessions…
                </div>
              ) : sessions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
                  No sessions match that.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {sessions.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-col justify-between rounded-xl border border-border bg-card p-4"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate font-display text-base font-bold">
                            {r.title}
                          </span>
                          <RoomStatusBadge status={r.status} />
                        </div>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          Code: {r.code}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-foreground">
                          {r.rounds_total} question{r.rounds_total === 1 ? "" : "s"} launched
                        </p>
                      </div>

                      {/* Live rooms stay reachable from here — a teacher who has
                          left the admin screen still needs a way back into the room,
                          and the projector needs a link to open display mode in its
                          own browser. */}
                      {(r.status === "lobby" || r.status === "active") && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="xs"
                            asChild
                            className="bg-[var(--ember)] text-white hover:bg-[var(--ember)]/90"
                          >
                            <Link href={`/room/${r.code}`}>
                              <Radio className="size-3" /> Live room
                            </Link>
                          </Button>
                          <Button variant="outline" size="xs" asChild>
                            <Link
                              href={`/room/${r.code}/display`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Monitor className="size-3" /> Display mode
                            </Link>
                          </Button>
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()} at{" "}
                          {new Date(r.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => void openRoomHistory(r)}
                          >
                            <BarChart3 className="size-3" /> View Summary
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            aria-label={`Delete ${r.title}`}
                            onClick={() => {
                              setSessionToDelete(r);
                              setSessionConfirmOpen(true);
                            }}
                          >
                            <Trash className="size-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(sessionsMore || (loadingSessions && sessions.length > 0)) && (
                <Button
                  variant="outline"
                  className="mx-auto"
                  disabled={loadingSessions}
                  onClick={() => void loadMoreSessions()}
                >
                  {loadingSessions && <Loader2 className="size-4 animate-spin" />} Load more
                </Button>
              )}
            </div>
          )}
        </main>
      </div>

      <QuestionBuilder
        key={builderSeq}
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        topics={topics}
        question={editingQuestion}
        defaultModule={builderModule}
        modules={namedModules.map((m) => m.name as string)}
        onSaved={() => {
          setBuilderOpen(false);
          refreshBank();
          void loadStats();
        }}
      />

      <JsonImporter
        open={importOpen}
        onOpenChange={setImportOpen}
        onSaved={() => {
          setImportOpen(false);
          refreshBank();
        }}
      />

      <AiPromptGuideModal
        open={guideOpen}
        onOpenChange={setGuideOpen}
        onOpenImport={() => {
          setGuideOpen(false);
          setImportOpen(true);
        }}
      />

      <ConfirmDialog
        open={sessionConfirmOpen}
        onOpenChange={setSessionConfirmOpen}
        busy={deletingSession}
        title={`Delete ${sessionToDelete?.title ?? "this session"}?`}
        description={
          sessionToDelete && (sessionToDelete.status === "lobby" || sessionToDelete.status === "active")
            ? "This room is still live: connected students are dropped and every answer, XP total and report card for it is deleted for good. This cannot be undone."
            : "Every answer, XP total and report card for this session is deleted for good, and its room code stops working. This cannot be undone."
        }
        confirmLabel="Delete session"
        onConfirm={() => void deleteSession()}
      />

      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-extrabold flex items-center gap-2">
              <Clock className="size-5 text-[var(--primary)]" /> Past Session History Summary
            </DialogTitle>
            <DialogDescription>
              Room:{" "}
              <span className="font-bold text-foreground">{selectedHistoryRoom?.title}</span> (
              {selectedHistoryRoom?.code})
            </DialogDescription>
          </DialogHeader>

          {loadingHistory ? (
            <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" /> Fetching room history metrics…
            </div>
          ) : !historySummary ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No summary recorded for this room.
            </div>
          ) : (
            <div className="grid gap-6">
              {/* Stats overview strip */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-border bg-card p-3 text-center">
                  <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                    Students
                  </p>
                  <p className="font-display text-2xl font-extrabold">{historySummary.students}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-3 text-center">
                  <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                    Questions
                  </p>
                  <p className="font-display text-2xl font-extrabold">{historySummary.questions}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-3 text-center">
                  <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                    Avg Accuracy
                  </p>
                  <p className="font-display text-2xl font-extrabold text-[var(--success)]">
                    {historySummary.avg_accuracy}%
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-3 text-center">
                  <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                    Responses
                  </p>
                  <p className="font-display text-2xl font-extrabold">
                    {historySummary.total_responses}
                  </p>
                </div>
              </div>

              {/* Olympic Top 3 Podium */}
              {historySummary.leaderboard && historySummary.leaderboard.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold tracking-widest text-muted-foreground uppercase">
                    🏆 Top 3 Podium Stand
                  </p>
                  <PodiumView leaderboard={historySummary.leaderboard} />
                </div>
              )}

              {/* Full session report card — every student who joined, not just
                  the leaderboard's top ten (which also drops anyone with zero
                  correct answers). */}
              <div>
                <p className="mb-2 text-xs font-bold tracking-widest text-muted-foreground uppercase">
                  Student Performance
                </p>
                <ReportCard rows={historySummary.report} questions={historySummary.questions} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------ furniture --- */

function NavButton({
  active,
  icon,
  label,
  badge,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
        active
          ? "border-[var(--ember)]/40 bg-[var(--ember)]/12 text-[var(--primary)]"
          : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span className="ml-auto rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
          {badge}
        </span>
      )}
    </button>
  );
}

function StatCard({
  label,
  value,
  icon,
  onClick,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
        {icon}
        {label}
      </span>
      <span className="mt-1 block font-display text-3xl font-extrabold tabular-nums">{value}</span>
    </>
  );

  if (!onClick) {
    return <div className="rounded-2xl border border-border bg-card p-4">{inner}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-[var(--ember)]/50"
    >
      {inner}
    </button>
  );
}

function QuickAction({
  icon,
  title,
  blurb,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  blurb: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--ember)]/50 hover:shadow-md"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--ember)]/12 text-[var(--primary)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-display text-sm font-bold">{title}</span>
        <span className="block text-xs text-muted-foreground">{blurb}</span>
      </span>
    </button>
  );
}

function RoomStatusBadge({ status }: { status: string }) {
  const live = status === "lobby" || status === "active";
  return (
    <Badge
      variant={live ? "default" : "secondary"}
      className={live ? "bg-[var(--ember)] text-white" : ""}
    >
      {status}
    </Badge>
  );
}

function AiPromptGuideModal({
  open,
  onOpenChange,
  onOpenImport,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpenImport: () => void;
}) {
  const fullAiPrompt = `You are a physics teacher's assistant. Generate a high-quality JSON array of physics classroom questions formatted for the Rain of Physics platform.

Strict Rules:
1. Output ONLY a valid JSON array of question objects (no markdown, no extra commentary).
2. "type" MUST be one of: "mcq", "true_false", "prediction", "numerical", "find_error", "exit_ticket".
3. For "mcq", "prediction", "find_error", "exit_ticket":
   - "options": array of 2 to 4 string choices.
   - "correct_answer": array with 0-indexed position of correct choice, e.g. [0] or [1].
4. For "true_false":
   - "options": ["True", "False"]
   - "correct_answer": [0] for True or [1] for False.
5. For "numerical":
   - "options": []
   - "correct_answer": ["<value>", "<tolerance>"], e.g. ["9.8", "0.1"].
6. "difficulty": "Easy", "Medium", "Hard", or "Boss".
7. "timer_seconds": integer between 10 and 90 (e.g., 30).
8. "explanation": short educational explanation why the answer is correct.

Example Format:
[
  {
    "prompt": "A object moves at constant velocity. What is its acceleration?",
    "type": "mcq",
    "options": ["Zero", "9.8 m/s²", "Increasing", "Depends on mass"],
    "correct_answer": [0],
    "explanation": "Constant velocity means zero rate of change of velocity, hence zero acceleration.",
    "timer_seconds": 30,
    "difficulty": "Easy"
  },
  {
    "prompt": "Calculate the force needed to accelerate a 5kg mass at 2 m/s².",
    "type": "numerical",
    "options": [],
    "correct_answer": ["10", "0"],
    "explanation": "F = m * a = 5 * 2 = 10 N.",
    "timer_seconds": 45,
    "difficulty": "Medium"
  }
]

Please generate 5 questions about [INSERT TOPIC HERE].`;

  const copyGuidePrompt = () => {
    void navigator.clipboard.writeText(fullAiPrompt);
    toast.success("AI Prompt Guide copied to clipboard!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold flex items-center gap-2">
            <BookOpen className="size-5 text-blue-500" /> AI Question Generator Guide (ChatGPT / Gemini)
          </DialogTitle>
          <DialogDescription>
            Use this master prompt guide to instruct ChatGPT, Gemini, or Claude to generate compatible Question Sets with zero syntax or formatting errors.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 p-4 text-xs space-y-2">
            <p className="font-bold text-blue-900 dark:text-blue-300">Supported Question Types:</p>
            <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
              <li><strong className="text-foreground">mcq</strong>: Multiple Choice Question (2–4 options, index in <code className="bg-muted px-1 rounded">correct_answer</code>).</li>
              <li><strong className="text-foreground">true_false</strong>: True/False (<code className="bg-muted px-1 rounded">[0]</code> for True, <code className="bg-muted px-1 rounded">[1]</code> for False).</li>
              <li><strong className="text-foreground">numerical</strong>: Numeric answer (<code className="bg-muted px-1 rounded">{`["value", "tolerance"]`}</code>, e.g. <code className="bg-muted px-1 rounded">{`["9.8", "0.1"]`}</code>).</li>
              <li><strong className="text-foreground">prediction</strong> / <strong className="text-foreground">find_error</strong> / <strong className="text-foreground">exit_ticket</strong>: Specialized conceptual activities.</li>
            </ul>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="font-bold">Full AI Master Prompt</Label>
              <Button size="xs" variant="outline" onClick={copyGuidePrompt}>
                Copy Full Prompt
              </Button>
            </div>
            <textarea
              readOnly
              rows={12}
              className="w-full rounded-md border border-border bg-muted/60 p-3 font-mono text-[11px] text-muted-foreground focus:outline-none"
              value={fullAiPrompt}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={copyGuidePrompt}>
            Copy Prompt &amp; Go to ChatGPT
          </Button>
          <Button onClick={onOpenImport} className="bg-[var(--ember)] text-white hover:bg-[var(--ember)]/90">
            Open Importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JsonImporter({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [setName, setSetName] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [busy, setBusy] = useState(false);

  const samplePrompt = `Prompt for ChatGPT / Gemini:
"Generate a JSON array of 5 physics questions in this exact JSON format:
[
  {
    "prompt": "What is Newton's First Law?",
    "type": "mcq",
    "options": ["Law of Inertia", "F=ma", "Action-Reaction", "Gravity"],
    "correct_answer": [0],
    "explanation": "Newton's 1st law is also known as the Law of Inertia.",
    "timer_seconds": 30,
    "difficulty": "Easy"
  }
]"`;

  const copySamplePrompt = () => {
    void navigator.clipboard.writeText(samplePrompt);
    toast.success("Copied ChatGPT/Gemini prompt template!");
  };

  async function handleImport() {
    if (!setName.trim()) return toast.error("Enter a Set Name (e.g., 'Kinematics Quiz 1')");
    if (!jsonText.trim()) return toast.error("Paste JSON questions first");

    let parsed: unknown[];
    try {
      const res = JSON.parse(jsonText.trim());
      if (!Array.isArray(res)) {
        throw new Error("JSON must be an array of question objects");
      }
      parsed = res;
    } catch {
      return toast.error("Invalid JSON format. Check syntax.");
    }

    setBusy(true);
    try {
      const rows = parsed.map((item) => {
        const q = item as Record<string, unknown>;
        return {
          set_name: setName.trim(),
          prompt: typeof q.prompt === "string" ? q.prompt : "Untitled Question",
          type: typeof q.type === "string" ? q.type : "mcq",
          options: Array.isArray(q.options) ? q.options : [],
          correct_answer: Array.isArray(q.correct_answer) ? q.correct_answer : [0],
          explanation: typeof q.explanation === "string" ? q.explanation : null,
          timer_seconds: typeof q.timer_seconds === "number" ? q.timer_seconds : 30,
          difficulty: typeof q.difficulty === "string" ? q.difficulty : "Medium",
        };
      });

      const { error } = await supabase.from("questions").insert(rows);
      if (error) throw new Error(error.message);

      toast.success(`Imported ${rows.length} questions into Set "${setName.trim()}"!`);
      setSetName("");
      setJsonText("");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import questions");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-extrabold">
            Bulk Import Question Set via AI (ChatGPT / Gemini)
          </DialogTitle>
          <DialogDescription>
            Generate questions with AI using the prompt template below, then paste the JSON result to save them as a Question Set.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="rounded-xl border border-border bg-muted/50 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-muted-foreground uppercase">AI Prompt Template</span>
              <Button size="xs" variant="ghost" onClick={copySamplePrompt}>
                Copy Prompt
              </Button>
            </div>
            <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-words">
              {samplePrompt}
            </pre>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="set-name">Question Set Name</Label>
            <Input
              id="set-name"
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              placeholder="e.g. Mechanics Chapter 1"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="json-paste">Paste JSON Output</Label>
            <textarea
              id="json-paste"
              rows={8}
              className="w-full rounded-md border border-border bg-card p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='[{"prompt": "...", "type": "mcq", ...}]'
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleImport()} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Import Set
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * What the builder opens with for a saved question: its options compacted
 * down to the slots that hold text, and the answer key remapped onto the same
 * compacted list so a gap in the stored array can never shift the key.
 */
function seedBank(q: BankQuestion | null | undefined): {
  options: string[];
  correctIndex: number;
} {
  const src = (q?.options ?? []).map((o) => (typeof o === "string" ? o : ""));
  const kept: string[] = [];
  const remap = new Map<number, number>();
  src.forEach((opt, i) => {
    if (opt.trim() !== "") {
      remap.set(i, kept.length);
      kept.push(opt);
    }
  });

  const list = [...kept];
  while (list.length < 4) list.push("");

  const raw = q?.correct_answer?.[0];
  const idx = typeof raw === "number" ? raw : Number(raw);
  let correctIndex = 0;
  if (q?.type === "true_false") correctIndex = idx === 1 ? 1 : 0;
  else if (Number.isFinite(idx)) correctIndex = remap.get(idx) ?? 0;

  return { options: list, correctIndex };
}

function QuestionBuilder({
  open,
  onOpenChange,
  topics,
  question,
  defaultModule,
  modules,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  topics: TopicRow[];
  /** When set, the dialog edits this saved question instead of creating one. */
  question?: BankQuestion | null;
  /** Pre-fills the module when adding from inside an existing module. */
  defaultModule?: string;
  /** Existing module names, offered as datalist suggestions. */
  modules?: string[];
  onSaved: () => void;
}) {
  // Everything below seeds once per mount: the parent keys this dialog on the
  // open action, so an edit starts from the saved question and a new one never
  // inherits whatever the previous dialog was showing.
  const seed = seedBank(question);
  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [moduleName, setModuleName] = useState(
    question ? (question.set_name ?? "") : (defaultModule ?? ""),
  );
  const [type, setType] = useState(question?.type ?? "mcq");
  const [options, setOptions] = useState(seed.options);
  const [correctIdx, setCorrectIdx] = useState(seed.correctIndex);
  const [numeric, setNumeric] = useState(
    question?.type === "numerical" ? String(question.correct_answer?.[0] ?? "") : "",
  );
  const [tolerance, setTolerance] = useState(
    question?.type === "numerical" ? String(question.correct_answer?.[1] ?? "0") : "0",
  );
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [timer, setTimer] = useState(question?.timer_seconds ?? 30);
  const [difficulty, setDifficulty] = useState<Difficulty>(question?.difficulty ?? "Medium");
  const [topicId, setTopicId] = useState<string>(question?.topic_id ?? "");
  const [busy, setBusy] = useState(false);

  // True / False presents a fixed, non-editable option shelf — the room's own
  // composer ships `["True","False"]` for that type, so the bank stores the
  // same thing and the "at least two options" rule stays honest.
  const shownOptions = type === "true_false" ? ["True", "False"] : options;

  const reset = () => {
    setPrompt("");
    setModuleName("");
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
    if (type === "numerical") {
      const value = numeric.trim();
      if (!value || !Number.isFinite(Number(value))) {
        toast.error("Enter a valid number");
        return;
      }
    }
    const clean = shownOptions.map((o) => o.trim()).filter(Boolean);
    if (type !== "numerical" && clean.length < 2) {
      toast.error("Add at least two options");
      return;
    }
    setBusy(true);
    try {
      const body =
        type === "numerical"
          ? { correct_answer: [numeric, tolerance], options: [] }
          : { correct_answer: [correctIdx], options: clean };

      const payload = {
        prompt: prompt.trim(),
        set_name: moduleName.trim() || null,
        type,
        options: body.options,
        correct_answer: body.correct_answer,
        explanation: explanation.trim() || null,
        timer_seconds: timer,
        difficulty,
        topic_id: topicId && topicId !== "none" ? topicId : null,
      };

      const { error } = question
        ? await supabase.from("questions").update(payload).eq("id", question.id)
        : await supabase.from("questions").insert(payload);
      if (error) throw new Error(error.message);
      toast.success(question ? "Question updated" : "Saved to your bank");
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
            {question ? "Edit question" : "New question"}
          </DialogTitle>
          <DialogDescription>
            {question
              ? "The updated wording and answer key are what every future launch uses."
              : "Saved to your persistent bank — rooms expire, this doesn't."}
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

          <div className="grid gap-2">
            <Label htmlFor="q-module">Module</Label>
            <Input
              id="q-module"
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              placeholder="e.g. Current Electricity"
              list="bank-modules"
              autoComplete="off"
            />
            <datalist id="bank-modules">
              {(modules ?? []).map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              Every question lives in a module — pick an existing one or type a new name.
            </p>
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
                  <SelectItem value="exit_ticket">Exit Ticket</SelectItem>
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
                {shownOptions.map((opt, i) => (
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
            {busy && <Loader2 className="size-4 animate-spin" />}{" "}
            {question ? "Save changes" : "Save question"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
