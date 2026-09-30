"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getTeacherState } from "@/lib/rpc";
import type { TeacherState } from "@/lib/types";

/**
 * Teacher-side live state.
 *
 * The teacher is authenticated, so besides polling we subscribe to Postgres
 * Changes on `responses` — that is what makes the live response graph tick
 * as students submit, without waiting for the next poll.
 */
export function useTeacherRoom(roomId: string | null) {
  const [state, setState] = useState<TeacherState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const fetching = useRef(false);
  const latest = useRef<TeacherState | null>(null);

  const refresh = useCallback(async () => {
    if (!roomId || fetching.current) return;
    fetching.current = true;
    try {
      const { data, error: err } = await getTeacherState(roomId);
      if (err) {
        setError(err);
      } else {
        setError(null);
        if (data) {
          latest.current = data;
          setState(data);
        }
      }
    } finally {
      fetching.current = false;
      setReady(true);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    void refresh();
    const id = window.setInterval(() => setTick((t) => t + 1), 2500);
    return () => window.clearInterval(id);
  }, [roomId, refresh, tick]);

  // Authoritative incremental updates straight from Postgres.
  useEffect(() => {
    if (!roomId) return;
    const channel = supabaseChannel(roomId);
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "responses", filter: `room_id=eq.${roomId}` },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `room_id=eq.${roomId}` },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activities", filter: `room_id=eq.${roomId}` },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void removeChannel(channel);
    };
  }, [roomId, refresh]);

  return { state, error, ready, refresh };
}

// Indirection keeps the supabase import in one place and the effect tidy.
import { supabase } from "@/lib/rpc";

function supabaseChannel(roomId: string) {
  return supabase.channel(`teacher:${roomId}`);
}

function removeChannel(channel: ReturnType<typeof supabase.channel>) {
  return supabase.removeChannel(channel);
}
