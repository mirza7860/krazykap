"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/rpc";

export type RoomEvent =
  | "refresh"
  | "launched"
  | "revealed"
  | "closed"
  | "answered"
  | "lobby";

export interface PresenceMember {
  nickname: string;
  kind: "student" | "teacher" | "display";
}

type Status = "connecting" | "subscribed" | "channel_error" | "closed";

/**
 * One realtime channel per room.
 *
 * Students hold no table privileges (they are `anon`), so they cannot use
 * Postgres Changes. Instead every client joins a Broadcast channel and any
 * state change triggers a `refresh` message; clients then refetch
 * authoritative state via RPC. Broadcast is only a signal — never a source
 * of truth — so a forged message can cause at worst an extra fetch.
 *
 * Presence rides the same channel to show live connection status.
 */
export function useRoomChannel(opts: {
  roomId: string | null;
  kind: PresenceMember["kind"];
  nickname?: string;
  onEvent?: (event: RoomEvent) => void;
  enabled?: boolean;
}) {
  const { roomId, kind, nickname, onEvent, enabled = true } = opts;
  const [status, setStatus] = useState<Status>("connecting");
  const [peerCount, setPeerCount] = useState(0);
  const [peers, setPeers] = useState<PresenceMember[]>([]);
  const onEventRef = useRef(onEvent);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const active = !!roomId && enabled;

  useEffect(() => {
    if (!active || !roomId) return;

    const channel = supabase.channel(`room:${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "signal" }, ({ payload }) => {
        const evt = (payload as { event?: RoomEvent })?.event;
        if (evt) onEventRef.current?.(evt);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceMember>();
        const all: PresenceMember[] = [];
        for (const key of Object.keys(state)) {
          for (const m of state[key] as PresenceMember[]) all.push(m);
        }
        setPeers(all);
        setPeerCount(all.length);
      })
      .subscribe(async (s) => {
        if (s === "SUBSCRIBED") {
          setStatus("subscribed");
          await channel.track({
            nickname: nickname ?? kind,
            kind,
          } satisfies PresenceMember);
        } else if (s === "CHANNEL_ERROR") {
          setStatus("channel_error");
        } else if (s === "CLOSED") {
          setStatus("closed");
        }
      });

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [active, roomId, kind, nickname]);

  const emit = useCallback((event: RoomEvent) => {
    void channelRef.current?.send({
      type: "broadcast",
      event: "signal",
      payload: { event },
    });
  }, []);

  // Idle when there is no room to join — derived rather than stored, so
  // toggling `enabled` never triggers a render cascade.
  const resolved: Status = active ? status : "closed";

  return { status: resolved, peerCount, peers, emit };
}
