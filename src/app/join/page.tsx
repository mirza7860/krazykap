"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowRight, QrCode } from "lucide-react";

/** Room-code alphabet — no I/L/O/0/1 so it survives being read off a board. */
const CLEAN = /^[A-Z0-9]{4,8}$/;

export default function JoinIndexPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const normalized = code.trim().toUpperCase();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!CLEAN.test(normalized)) {
      setError("Room codes are 4–8 letters or numbers.");
      return;
    }
    router.push(`/join/${normalized}`);
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-5 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(245,113,31,0.4), rgba(240,180,41,0.16) 55%, transparent 78%)",
        }}
      />

      <Link href="/" aria-label="Home" className="relative z-10 mb-8">
        <Logo />
      </Link>

      <Card className="relative z-10 w-full max-w-md border-border shadow-lg">
        <CardHeader className="text-center">
          <span className="mx-auto mb-2 grid size-12 place-items-center rounded-2xl bg-[var(--ember)]/12 text-[var(--primary)]">
            <QrCode className="size-6" />
          </span>
          <CardTitle className="font-display text-2xl font-extrabold">
            Join your class
          </CardTitle>
          <CardDescription>
            Enter the room code from the board. No account, no email — just a
            nickname.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="code">Room code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                placeholder="e.g. K7MPQ2"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={8}
                className="room-code h-14 text-center text-2xl tracking-[0.3em] uppercase"
                autoFocus
                aria-invalid={!!error}
              />
              {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
            </div>

            <Button type="submit" size="lg" className="h-12 text-base">
              Continue <ArrowRight className="size-4" />
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Scanning a QR? It takes you straight to the nickname screen.
          </p>
        </CardContent>
      </Card>

      <Link
        href="/"
        className="relative z-10 mt-8 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        ← Back home
      </Link>
    </div>
  );
}
