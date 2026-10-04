"use client";

/**
 * Generate a whole question set with AI, then approve it question by
 * question before anything touches the bank.
 *
 * Step 1 "compose": set name (optional — Gemini proposes one when left
 * blank), a brief in the AI Elements prompt box, difficulty and type chips
 * → POST /api/generate-set (server-side key,
 * never exposed to this component). How many questions to write is read
 * out of the brief itself (default 10), so there is no count control.
 * Step 2 "review": every draft arrives
 * already validated; the teacher ticks which ones to keep, and only those
 * are inserted — as one new set/module.
 */
import { useState } from "react";
import { Check, Clock, Loader2, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_COUNT,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  SET_DIFFICULTIES,
  type GenerateSetResponse,
  type GeneratedQuestion,
  type QuestionType,
  type SetDifficulty,
  deriveNameFromBrief,
} from "@/lib/ai-set";
import { supabase } from "@/lib/rpc";
import { formatDuration } from "@/lib/time";
import { cn } from "@/lib/utils";

/** One draft as the review step holds it — approval state rides along. */
type DraftQuestion = GeneratedQuestion & { approved: boolean };

const OPTION_LETTERS = ["A", "B", "C", "D"];

export function AiSetGenerator({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called after the approved questions are saved, to refresh the bank. */
  onSaved: () => void;
}) {
  const [step, setStep] = useState<"compose" | "review">("compose");
  const [setName, setSetName] = useState("");
  const [brief, setBrief] = useState("");
  const [difficulty, setDifficulty] = useState<SetDifficulty>("Mixed");
  const [types, setTypes] = useState<QuestionType[]>([...QUESTION_TYPES]);
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);

  const approved = questions.filter((q) => q.approved);

  // A fresh open always starts at compose — every close path (X, Escape,
  // Cancel, a successful save) resets here, so the typed brief and set name
  // can survive between rounds without dragging a stale review back up.
  function handleOpenChange(v: boolean) {
    if (!v) setStep("compose");
    onOpenChange(v);
  }

  function toggleType(t: QuestionType) {
    setTypes((prev) => {
      const next = prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t];
      // Keep bank order regardless of click order.
      return QUESTION_TYPES.filter((x) => next.includes(x));
    });
  }

  function toggleAt(index: number) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, approved: !q.approved } : q)),
    );
  }

  function setAll(value: boolean) {
    setQuestions((prev) => prev.map((q) => ({ ...q, approved: value })));
  }

  async function generate(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3) return toast.error("Describe the questions you want first");
    if (types.length === 0) return toast.error("Pick at least one question type");

    setBrief(trimmed);
    setBusy(true);
    try {
      const res = await fetch("/api/generate-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: trimmed, difficulty, types }),
      });
      const payload: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          payload && typeof payload === "object" && "message" in payload
            ? String((payload as { message?: unknown }).message ?? "")
            : "";
        throw new Error(message || "Generation failed");
      }

      const data = payload as GenerateSetResponse;
      setQuestions(data.questions.map((q) => ({ ...q, approved: true })));
      // A name the teacher typed always wins; otherwise fall back to the
      // title Gemini proposed, then to one derived from the brief itself.
      setSetName((prev) => prev.trim() || data.setName || deriveNameFromBrief(trimmed));
      if (data.dropped > 0) {
        toast.warning(
          `${data.dropped} generated question${data.dropped === 1 ? "" : "s"} failed validation and ${
            data.dropped === 1 ? "was" : "were"
          } skipped`,
        );
      }
      setStep("review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function addApproved() {
    if (approved.length === 0) return toast.error("Approve at least one question");
    const name = setName.trim();
    if (!name) return toast.error("Give this set a name first");

    setBusy(true);
    try {
      const rows = approved.map((q) => ({
        set_name: name,
        prompt: q.prompt,
        type: q.type,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        timer_seconds: q.timer_seconds,
        difficulty: q.difficulty,
      }));
      const { error } = await supabase.from("questions").insert(rows);
      if (error) throw new Error(error.message);
      toast.success(
        `Added ${rows.length} question${rows.length === 1 ? "" : "s"} to “${name}”`,
      );
      setStep("compose");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the set");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2 text-xl font-extrabold">
            <WandSparkles className="size-5 text-[var(--primary)]" />
            {step === "compose" ? "Generate a set with AI" : "Approve the questions you want"}
          </DialogTitle>
          <DialogDescription>
            {step === "compose"
              ? "Describe the class you're teaching — Gemini drafts the set, then you approve each question before it enters your bank."
              : `${approved.length} of ${questions.length} approved. Only ticked questions are saved, as one new set.`}
          </DialogDescription>
        </DialogHeader>

        {step === "compose" ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ai-set-name">
                Set name{" "}
                <span className="font-normal text-muted-foreground">(becomes the module)</span>
              </Label>
              <Input
                id="ai-set-name"
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
                placeholder="e.g. Newton's Laws Quiz 1"
              />
              <p className="text-xs text-muted-foreground">
                Leave it blank and the AI names the set from your brief.
              </p>
            </div>

            <div className="grid gap-2">
              <Label>What should the questions cover?</Label>
              <PromptInputProvider initialInput={brief}>
                <BriefPrompt
                  busy={busy}
                  onChange={setBrief}
                  onGenerate={(text) => void generate(text)}
                />
              </PromptInputProvider>
            </div>

            <div className="grid gap-2">
              <Label>Difficulty</Label>
              <Select
                value={difficulty}
                onValueChange={(v) => setDifficulty((v ?? "Mixed") as SetDifficulty)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SET_DIFFICULTIES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Question types</Label>
              <div className="flex flex-wrap gap-2">
                {QUESTION_TYPES.map((t) => {
                  const on = types.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleType(t)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                        on
                          ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                          : "border-border bg-card text-muted-foreground hover:border-[var(--ember)]/50 hover:text-foreground",
                      )}
                    >
                      {QUESTION_TYPE_LABELS[t]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : busy ? (
          <GeneratingPanel />
        ) : (
          <div className="grid gap-4">
            <Message
              from="assistant"
              className="rounded-2xl border border-border bg-muted/40 p-3"
            >
              <MessageContent className="text-sm">
                <MessageResponse>
                  {`Drafted **${questions.length} question${questions.length === 1 ? "" : "s"}** for **${setName.trim()}**. Tick the ones you want to keep — the rest stay out of your bank.`}
                </MessageResponse>
              </MessageContent>
            </Message>

            <div className="grid gap-2">
              <Label htmlFor="ai-review-name">
                Set name{" "}
                <span className="font-normal text-muted-foreground">(becomes the module)</span>
              </Label>
              <Input
                id="ai-review-name"
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
                placeholder="Set name"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                {approved.length} of {questions.length} approved
              </p>
              <div className="flex gap-1">
                <Button size="xs" variant="ghost" onClick={() => setAll(true)}>
                  All
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setAll(false)}>
                  None
                </Button>
              </div>
            </div>

            <ul className="grid gap-3">
              {questions.map((q, i) => (
                <ReviewCard key={`${q.type}-${i}`} q={q} onToggle={() => toggleAt(i)} />
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "compose" ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void generate(brief)}
                disabled={busy || brief.trim().length < 3}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <WandSparkles className="size-4" />
                )}
                {busy ? "Generating…" : "Generate set"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("compose")} disabled={busy}>
                Adjust inputs
              </Button>
              <Button variant="outline" onClick={() => void generate(brief)} disabled={busy}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <WandSparkles className="size-4" />
                )}
                Regenerate
              </Button>
              <Button onClick={() => void addApproved()} disabled={busy || approved.length === 0}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Add {approved.length} to set
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------- compose */

/**
 * The prompt box itself. Lives inside a PromptInputProvider so the text can
 * also be read and written from out here — the footer reports its state.
 */
function BriefPrompt({
  busy,
  onChange,
  onGenerate,
}: {
  busy: boolean;
  onChange: (text: string) => void;
  onGenerate: (text: string) => void;
}) {
  const { textInput } = usePromptInputController();
  const ready = !busy && textInput.value.trim().length >= 3;

  return (
    <div className="grid gap-3">
      <PromptInput
        className="rounded-2xl border border-border bg-card/60 p-3"
        onSubmit={(message) => {
          if (message.text.trim()) onGenerate(message.text);
        }}
      >
        <PromptInputTextarea
          value={textInput.value}
          onChange={(e) => onChange(e.currentTarget.value)}
          placeholder={`e.g. ${DEFAULT_COUNT} questions on Newton's laws and friction for grade 9…`}
          className="min-h-20"
        />
        <PromptInputFooter className="mt-2 justify-between border-t border-border pt-2">
          <p className="text-[11px] text-muted-foreground">
            {busy ? "Writing your set…" : "Press the button or Ctrl + Enter"}
          </p>
          <PromptInputSubmit
            status={busy ? "streaming" : "ready"}
            disabled={!ready}
            aria-label="Generate set"
          />
        </PromptInputFooter>
      </PromptInput>

      <p className="text-[11px] text-muted-foreground">
        Defaults to {DEFAULT_COUNT} questions — name a different number in your brief (like “20
        questions”) and the AI follows that instead.
      </p>

      {busy && <GeneratingPanel compact />}
    </div>
  );
}

/* --------------------------------------------------------------- review */

function GeneratingPanel({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "grid place-items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 text-center",
        compact ? "p-4" : "p-6",
      )}
    >
      <Loader2 className="size-5 animate-spin text-[var(--primary)]" />
      <Shimmer className="font-display text-sm font-bold">
        Writing your question set…
      </Shimmer>
      <p className="max-w-sm text-xs text-muted-foreground">
        Usually 10–30 seconds. Every answer key is validated before you see it.
      </p>
    </div>
  );
}

function ReviewCard({ q, onToggle }: { q: DraftQuestion; onToggle: () => void }) {
  const correctIndex = Number(q.correct_answer[0]);
  const isNumerical = q.type === "numerical";

  const answerLabel = isNumerical
    ? `Answer ${q.correct_answer[0]}${
        q.correct_answer[1] !== undefined && String(q.correct_answer[1]) !== "0"
          ? ` ± ${q.correct_answer[1]}`
          : ""
      }`
    : q.type === "true_false"
      ? `Answer ${correctIndex === 0 ? "True" : "False"}`
      : null;

  return (
    <li
      className={cn(
        "rounded-2xl border bg-card p-4 transition-opacity",
        q.approved ? "border-border" : "border-border/50 opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={q.approved}
          onCheckedChange={onToggle}
          aria-label="Approve this question"
          className="mt-1"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{QUESTION_TYPE_LABELS[q.type]}</Badge>
            <Badge variant="outline">{q.difficulty}</Badge>
            <Badge variant="outline">
              <Clock className="mr-1 size-3" />
              {formatDuration(q.timer_seconds)}
            </Badge>
            {answerLabel && (
              <Badge className="bg-[var(--primary)] text-white">{answerLabel}</Badge>
            )}
          </div>
          <p className="mt-2 text-sm font-semibold leading-snug">{q.prompt}</p>
        </div>
      </div>

      {!isNumerical && (
        <ul className="mt-3 grid gap-1.5">
          {q.options.map((option, i) => {
            const right = i === correctIndex;
            return (
              <li
                key={`${i}-${option}`}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
                  right
                    ? "border-[var(--primary)]/50 bg-[var(--primary)]/10 font-bold text-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                <span className="font-display w-4 shrink-0 text-center font-extrabold">
                  {OPTION_LETTERS[i]}
                </span>
                <span className="min-w-0">{option}</span>
                {right && <Check className="ml-auto size-3.5 shrink-0 text-[var(--primary)]" />}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 rounded-lg bg-[var(--gold)]/10 px-3 py-2">
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
          Why
        </p>
        <p className="mt-0.5 text-xs leading-relaxed">{q.explanation}</p>
      </div>
    </li>
  );
}
