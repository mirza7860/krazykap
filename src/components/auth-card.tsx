"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/rpc";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";

function friendly(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("invalid login")) return "That email and password combination didn't work.";
  if (m.includes("already registered")) return "An account already exists for this email.";
  if (m.includes("password should be")) return "Password must be at least 6 characters.";
  if (m.includes("email not confirmed")) return "Confirm your email first — check your inbox.";
  if (m.includes("fetch")) return "Network error. Check your connection and try again.";
  return raw;
}

export function AuthCard() {
  const router = useRouter();
  const params = useSearchParams();
  const initialMode = params.get("mode") === "signup" ? "signup" : "login";

  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setInfo(null);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name || "Teacher" } },
        });
        if (error) throw new Error(error.message);

        // Email confirmation is enabled on this project, so a session may not
        // come back immediately.
        if (data.session) {
          toast.success("Welcome to Rain of Physics");
          router.push("/dashboard");
          router.refresh();
        } else {
          setInfo(
            "Account created. Check your inbox to confirm, then sign in — the link may take a minute.",
          );
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        toast.success("Signed in");
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      toast.error(friendly(err instanceof Error ? err.message : "Something went wrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[760px] -translate-x-1/2 rounded-full opacity-55 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(245,113,31,0.4), rgba(240,180,41,0.15) 58%, transparent 80%)",
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Link href="/" aria-label="Rain of Physics home">
            <Logo />
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl font-extrabold">
              {mode === "login" ? "Teacher sign in" : "Create your account"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Open the control centre for your live room."
                : "One account for your question bank and every room you run."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={submit} className="grid gap-4">
              {mode === "signup" && (
                <div className="grid gap-2">
                  <Label htmlFor="name">Display name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ms. Sharma"
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                  autoComplete="email"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>

              {info && (
                <p className="rounded-lg border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-3 py-2 text-xs text-foreground">
                  {info}
                </p>
              )}

              <Button type="submit" disabled={busy} className="mt-1 h-11 text-base">
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {mode === "login" ? "Sign in" : "Create account"}
                {!busy && <ArrowRight className="size-4" />}
              </Button>
            </form>

            <div className="mt-5 text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>
                  New here?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="font-semibold text-[var(--primary)] hover:underline"
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have one?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="font-semibold text-[var(--primary)] hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Students don&apos;t need this — they join with a nickname only.
        </p>
      </div>
    </div>
  );
}
