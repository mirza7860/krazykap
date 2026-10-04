"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { supabase } from "@/lib/rpc";
import { DIFFICULTIES } from "@/lib/game";
import { formatDuration } from "@/lib/time";
import { toast } from "sonner";
import {
  BookOpen,
  ChevronDown,
  Clock,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash,
  Upload,
  WandSparkles,
  Zap,
} from "lucide-react";
import type { Difficulty } from "@/lib/types";
import type { BankModule } from "@/lib/bank";

/**
 * The question bank is module-based: every question belongs to a module (the
 * `set_name` the room's question paper already groups by). Nothing here is
 * ever loaded in bulk — the module list is paged by the caller, a module's
 * questions are fetched only when it is opened, and search runs on the server,
 * so 100 modules × 100 questions behaves exactly like 2 × 5.
 */

/** Rows per request — both for a module's questions and for search results. */
const PAGE = 25;

/** Filter value standing in for the "saved without a module" bucket. */
const NONE = "__none__";

export type QuestionModule = BankModule;

export interface BankQuestion {
  id: string;
  prompt: string;
  type: string;
  difficulty: Difficulty;
  options: string[];
  correct_answer: (string | number)[];
  explanation: string | null;
  timer_seconds: number;
  topic_id: string | null;
  set_name: string | null;
}

const TYPES: { value: string; label: string }[] = [
  { value: "mcq", label: "MCQ" },
  { value: "true_false", label: "True / False" },
  { value: "prediction", label: "Prediction" },
  { value: "numerical", label: "Numerical" },
  { value: "find_error", label: "Find the Error" },
  { value: "exit_ticket", label: "Exit Ticket" },
];

export function moduleLabel(name: string | null) {
  return name ?? "No module";
}

/** PostgREST filter syntax treats these as control characters. */
function sanitize(term: string) {
  return term.replace(/[%,()]/g, " ").trim();
}

type Expanded = { key: string; name: string | null } | null;
type Pending =
  | { kind: "question"; question: BankQuestion }
  | { kind: "module"; module: QuestionModule };

export function QuestionBank({
  modules,
  moduleTotal,
  moduleSearch,
  moduleMore,
  loadingModules,
  loadingMoreModules,
  onModuleSearch,
  onLoadMoreModules,
  total,
  version,
  onChanged,
  onNewQuestion,
  onEditQuestion,
  onImport,
  onGuide,
  onGenerate,
}: {
  /** The page of modules the dashboard has loaded so far. */
  modules: QuestionModule[];
  /** How many modules match `moduleSearch` in total. */
  moduleTotal: number;
  moduleSearch: string;
  moduleMore: boolean;
  loadingModules: boolean;
  loadingMoreModules: boolean;
  onModuleSearch: (value: string) => void;
  onLoadMoreModules: () => void;
  total: number;
  /** Bumped whenever the bank changes, to drop stale caches. */
  version: number;
  /** Fired after any delete so the dashboard can re-count and re-page. */
  onChanged: () => void;
  onNewQuestion: (moduleName: string | null) => void;
  /** Opens the builder pre-filled with a saved question. */
  onEditQuestion: (question: BankQuestion) => void;
  onImport: () => void;
  onGuide: () => void;
  /** Opens the AI set generator — drafts a whole set for approval. */
  onGenerate: () => void;
}) {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");

  // Module accordion — one open at a time, each fetched on first open.
  const [expanded, setExpanded] = useState<Expanded>(null);
  const [rows, setRows] = useState<Record<string, BankQuestion[]>>({});
  const [hasMore, setHasMore] = useState<Record<string, boolean>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  // Search / filter results.
  const [results, setResults] = useState<BankQuestion[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsMore, setResultsMore] = useState(false);

  // Destructive confirmation. `target` outlives `open` so the dialog keeps its
  // wording while it animates out.
  const [target, setTarget] = useState<Pending | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const resultsReq = useRef(0);
  const expandReq = useRef(0);

  const filtering = term !== "" || typeFilter !== "all" || difficultyFilter !== "all";

  useEffect(() => {
    const t = setTimeout(() => setTerm(sanitize(query)), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchPage = useCallback(
    async (offset: number, moduleName: string | null | undefined) => {
      let q = supabase
        .from("questions")
        .select(
          "id,prompt,type,difficulty,options,correct_answer,explanation,timer_seconds,topic_id,set_name",
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE - 1);

      if (term) q = q.ilike("prompt", `%${term}%`);
      if (moduleName !== undefined) {
        q = moduleName === null ? q.is("set_name", null) : q.eq("set_name", moduleName);
      }
      if (typeFilter !== "all") q = q.eq("type", typeFilter);
      if (difficultyFilter !== "all") q = q.eq("difficulty", difficultyFilter);

      const { data, error } = await q;
      if (error) {
        toast.error(error.message);
        return [];
      }
      return (data ?? []) as unknown as BankQuestion[];
    },
    [term, typeFilter, difficultyFilter],
  );

  // Search / filter mode: a server-side query, so the whole bank is searched,
  // not just whatever happens to be loaded. `version` is a dependency, so a
  // save or a delete elsewhere re-runs it and the fresh page replaces the old.
  useEffect(() => {
    if (!filtering) return;
    const id = ++resultsReq.current;
    void (async () => {
      setResultsLoading(true);
      const page = await fetchPage(0, undefined);
      if (id !== resultsReq.current) return;
      setResults(page);
      setResultsMore(page.length === PAGE);
      setResultsLoading(false);
    })();
  }, [filtering, fetchPage, version]);

  // The open module's rows — refetched when it is opened, when the bank
  // changes, or when a filter narrows what it should show.
  useEffect(() => {
    if (!expanded) return;
    const id = ++expandReq.current;
    void (async () => {
      setLoadingKey(expanded.key);
      const page = await fetchPage(0, expanded.name);
      if (id !== expandReq.current) return;
      setRows((r) => ({ ...r, [expanded.key]: page }));
      setHasMore((h) => ({ ...h, [expanded.key]: page.length === PAGE }));
      setLoadingKey(null);
    })();
  }, [expanded, fetchPage, version]);

  function toggleModule(m: QuestionModule) {
    const key = m.name ?? NONE;
    if (expanded?.key === key) {
      setExpanded(null);
      return;
    }
    setExpanded({ key, name: m.name });
  }

  async function loadMoreModule() {
    if (!expanded) return;
    const offset = rows[expanded.key]?.length ?? 0;
    setLoadingKey(expanded.key);
    const page = await fetchPage(offset, expanded.name);
    setRows((r) => ({ ...r, [expanded.key]: [...(r[expanded.key] ?? []), ...page] }));
    setHasMore((h) => ({ ...h, [expanded.key]: page.length === PAGE }));
    setLoadingKey(null);
  }

  async function loadMoreResults() {
    const id = resultsReq.current;
    setResultsLoading(true);
    const page = await fetchPage(results.length, undefined);
    if (id !== resultsReq.current) return;
    setResults((r) => [...r, ...page]);
    setResultsMore(page.length === PAGE);
    setResultsLoading(false);
  }

  function clearFilters() {
    setQuery("");
    setTerm("");
    setTypeFilter("all");
    setDifficultyFilter("all");
  }

  function askToDeleteQuestion(question: BankQuestion) {
    setTarget({ kind: "question", question });
    setConfirmOpen(true);
  }

  function askToDeleteModule(module: QuestionModule) {
    setTarget({ kind: "module", module });
    setConfirmOpen(true);
  }

  async function runDelete() {
    if (!target || deleting) return;
    setDeleting(true);
    try {
      if (target.kind === "question") {
        const { error } = await supabase
          .from("questions")
          .delete()
          .eq("id", target.question.id);
        if (error) throw new Error(error.message);
        toast.success("Question deleted");
      } else {
        const m = target.module;
        const base = supabase.from("questions").delete({ count: "exact" });
        const { error, count } = await (m.name === null
          ? base.is("set_name", null)
          : base.eq("set_name", m.name));
        if (error) throw new Error(error.message);
        const n = count ?? m.count;
        toast.success(
          `Deleted ${n} question${n === 1 ? "" : "s"} from ${moduleLabel(m.name)}`,
        );
        // The module is gone — collapse it instead of refetching an empty shell.
        setExpanded(null);
      }
      setConfirmOpen(false);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg font-extrabold">
            <BookOpen className="size-5 text-[var(--primary)]" /> Question bank
          </CardTitle>
          <CardDescription>
            {loadingModules
              ? "Counting your bank…"
              : `${total} question${total === 1 ? "" : "s"} across ${moduleTotal} module${
                  moduleTotal === 1 ? "" : "s"
                }. Modules are the Sets the room's question paper teaches from.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search every question in your bank…"
                className="h-10 pl-9"
                aria-label="Search questions"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onNewQuestion(null)}>
                <Plus className="size-4" /> New question
              </Button>
              <Button variant="outline" onClick={onGenerate}>
                <WandSparkles className="size-4 text-[var(--primary)]" /> Generate with AI
              </Button>
              <Button variant="outline" onClick={onImport}>
                <Upload className="size-4 text-[var(--ember)]" /> Import
              </Button>
              <Button variant="outline" onClick={onGuide}>
                <Sparkles className="size-4 text-blue-500" /> AI guide
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any type</SelectItem>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Difficulty</Label>
              <Select
                value={difficultyFilter}
                onValueChange={(v) => setDifficultyFilter(v ?? "all")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any difficulty</SelectItem>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------- body */}
      {!loadingModules && total === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <p className="font-display text-lg font-bold">No saved questions yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Save a question once and you can relaunch it next class. Rooms are temporary —
            your bank isn&apos;t.
          </p>
          <Button className="mt-5" onClick={() => onNewQuestion(null)}>
            <Plus className="size-4" /> Create your first question
          </Button>
        </div>
      ) : filtering ? (
        <section className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {resultsLoading && results.length === 0
                ? "Searching…"
                : `${results.length}${resultsMore ? "+" : ""} match${results.length === 1 ? "" : "es"}`}
            </p>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          </div>

          {results.length === 0 && !resultsLoading ? (
            <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              Nothing matches those filters.
            </div>
          ) : (
            <ul className="grid gap-3">
              {results.map((q) => (
                <QuestionRow
                  key={q.id}
                  q={q}
                  showModule
                  onEdit={() => onEditQuestion(q)}
                  onDelete={() => askToDeleteQuestion(q)}
                />
              ))}
            </ul>
          )}

          {(resultsMore || resultsLoading) && results.length > 0 && (
            <Button
              variant="outline"
              disabled={resultsLoading}
              onClick={() => void loadMoreResults()}
              className="mx-auto"
            >
              {resultsLoading && <Loader2 className="size-4 animate-spin" />} Load more
            </Button>
          )}
        </section>
      ) : (
        <section className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={moduleSearch}
                onChange={(e) => onModuleSearch(e.target.value)}
                placeholder="Filter modules…"
                className="h-9 pl-9"
                aria-label="Filter modules"
              />
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {loadingModules
                ? "…"
                : `${modules.length} of ${moduleTotal} module${moduleTotal === 1 ? "" : "s"}`}
            </p>
          </div>

          {loadingModules && modules.length === 0 ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading modules…
            </div>
          ) : modules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
              No module matches &ldquo;{moduleSearch}&rdquo;.
            </div>
          ) : (
            <ul className="grid gap-3">
              {modules.map((m) => {
                const key = m.name ?? NONE;
                const open = expanded?.key === key;
                const list = rows[key];
                return (
                  <li key={key} className="rounded-2xl border border-border bg-card">
                    <div className="flex items-center gap-2 p-4 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => toggleModule(m)}
                        aria-expanded={open}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--ember)]/12 text-[var(--primary)]">
                          <Layers className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-display text-base font-bold">
                            {moduleLabel(m.name)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {m.count} question{m.count === 1 ? "" : "s"}
                            {m.name === null && " · saved without a module"}
                          </span>
                        </span>
                        <ChevronDown
                          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                            open ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          size="xs"
                          variant="outline"
                          title="Add a question to this module"
                          onClick={() => onNewQuestion(m.name)}
                        >
                          <Plus className="size-3" /> Add
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={`Delete ${moduleLabel(m.name)}`}
                          onClick={() => askToDeleteModule(m)}
                        >
                          <Trash className="size-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {open && (
                      <div className="border-t border-border/70 p-4">
                        {loadingKey === key && !list ? (
                          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" /> Loading questions…
                          </div>
                        ) : list && list.length === 0 ? (
                          <p className="py-4 text-center text-sm text-muted-foreground">
                            {typeFilter === "all" && difficultyFilter === "all"
                              ? "This module is empty."
                              : "No questions in this module match those filters."}
                          </p>
                        ) : (
                          <ul className="grid gap-2">
                            {(list ?? []).map((q) => (
                              <QuestionRow
                                key={q.id}
                                q={q}
                                onEdit={() => onEditQuestion(q)}
                                onDelete={() => askToDeleteQuestion(q)}
                              />
                            ))}
                          </ul>
                        )}

                        {hasMore[key] && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            disabled={loadingKey === key}
                            onClick={() => void loadMoreModule()}
                          >
                            {loadingKey === key && (
                              <Loader2 className="size-4 animate-spin" />
                            )}{" "}
                            Load more
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {moduleMore && (
            <Button
              variant="outline"
              className="mx-auto"
              disabled={loadingMoreModules}
              onClick={onLoadMoreModules}
            >
              {loadingMoreModules && <Loader2 className="size-4 animate-spin" />} Load more
              modules
            </Button>
          )}
        </section>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        busy={deleting}
        title={
          target?.kind === "module"
            ? `Delete ${moduleLabel(target.module.name)}?`
            : "Delete this question?"
        }
        description={
          target?.kind === "module"
            ? `All ${target.module.count} question${
                target.module.count === 1 ? "" : "s"
              } in this module are removed from your bank. Rounds already launched in a
              room keep their own copy. This cannot be undone.`
            : "It is removed from your bank for every future class. Rounds already launched keep their own copy. This cannot be undone."
        }
        confirmLabel={target?.kind === "module" ? "Delete module" : "Delete question"}
        onConfirm={() => void runDelete()}
      />
    </div>
  );
}

function QuestionRow({
  q,
  showModule,
  onEdit,
  onDelete,
}: {
  q: BankQuestion;
  showModule?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium break-words">{q.prompt}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {showModule && (
              <Badge className="border-[var(--ember)]/30 bg-[var(--ember)]/15 font-bold text-[var(--primary)]">
                {moduleLabel(q.set_name)}
              </Badge>
            )}
            <Badge variant="outline">{q.type.replace("_", " ")}</Badge>
            <Badge variant="outline">{q.difficulty}</Badge>
            <Badge variant="outline">
              <Clock className="size-3" /> {formatDuration(q.timer_seconds)}
            </Badge>
            {q.type === "numerical" && q.correct_answer?.length > 0 && (
              <Badge variant="secondary">
                <Zap className="size-3" /> {String(q.correct_answer[0])}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Edit question"
            onClick={onEdit}
          >
            <Pencil className="size-3.5 text-muted-foreground" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Delete question"
            onClick={onDelete}
          >
            <Trash className="size-3.5 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </div>
    </li>
  );
}
