"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getRoomState } from "@/lib/rpc";
import { announceLeave } from "@/lib/leave-room";
import type { StudentState } from "@/lib/types";
import { clearSession, loadSession, type StoredSession } from "@/lib/session";

export type StudentPhase =
  | "loading"
  | "join"
  | "lobby"
  | "question"
  | "submitted"
  | "result"
  | "closed"
  | "error";

/** Maps server state to the six screens in PRD §18. */
export function phaseFor(state: StudentState | null, hasSession: boolean): StudentPhase {
  if (!state) return hasSession ? "loading" : "join";
  if (state.room.status === "closed" || state.room.status === "expired") return "closed";

  const a = state.activity;
  if (!a || a.state === "closed") return "lobby";

  switch (a.state) {
    case "answering":
      return a.has_response ? "submitted" : "question";
    case "distribution":
      return a.has_response ? "submitted" : "question";
    case "revealed":
      return "result";
    case "leaderboard":
      return "result";
    default:
      return "lobby";
  }
}

/**
 * Owns the student's connection to a room: restores a saved session
 * (reconnection after Wi-Fi blips), fetches authoritative state, refetches on
 * broadcast signals, and polls as a safety net.
 */
export function useStudentRoom(roomCode: string) {
  const [state, setState] = useState<StudentState | null>(null);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const fetching = useRef(false);

  // Restore any previously saved session for this room. Must run after mount:
  // localStorage does not exist while rendering on the server, and reading it
  // during render would mismatch the hydrated HTML.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only storage read
    setSession(loadSession(roomCode));
    setLoading(false);
  }, [roomCode]);

  const refresh = useCallback(async () => {
    const s = loadSession(roomCode);
    if (!s) return;
    if (fetching.current) return;
    fetching.current = true;
    try {
      const { data, error: err } = await getRoomState(s.token);
      if (err === "invalid_session") {
        clearSession(roomCode);
        setSession(null);
        setState(null);
        setError(null);
        return;
      }
      if (err) {
        setError(err);
        return;
      }
      if (data) {
        setError(null);
        setState(data);
      }
    } finally {
      fetching.current = false;
    }
  }, [roomCode]);

  useEffect(() => {
    if (!session) return;
    void refresh();
  }, [session, refresh, tick]);

  // Poll: keeps `last_seen` fresh and covers any missed broadcast.
  useEffect(() => {
    if (!session) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 4000);
    return () => window.clearInterval(id);
  }, [session]);

  /**
   * Resign the seat as the tab dies. Doing it from the page itself is what
   * makes "the student closed their tab" take effect immediately: the name
   * comes off every roster at once, and their saved token stops resolving so
   * coming back means joining again by name. Their XP and answers stay.
   */
  useEffect(() => {
    if (!session) return;
    const onPageHide = () => announceLeave(session.token);
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [session]);

  const adopt = useCallback((s: StoredSession) => {
    setSession(s);
    setError(null);
  }, []);

  const forget = useCallback(() => {
    clearSession(roomCode);
    setSession(null);
    setState(null);
  }, [roomCode]);

  return {
    // A session is the only thing that can grant state, so derive this instead
    // of clearing it from an effect.
    state: session ? state : null,
    session,
    error,
    loading,
    phase: phaseFor(state, !!session),
    refresh,
    adopt,
    forget,
    setSession,
  };
}
