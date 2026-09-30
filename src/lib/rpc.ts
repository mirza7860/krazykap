"use client";

import { createClient } from "@/lib/client";
import type {
  JoinResult,
  LeaderboardMode,
  SessionSummary,
  StudentState,
  TeacherState,
} from "@/lib/types";

export const supabase = createClient();

/** Normalises Supabase RPC failures into a short, displayable code. */
export function rpcError(error: { message?: string } | null): string {
  if (!error) return "unknown_error";
  const msg = error.message ?? "";
  const known = [
    "room_not_found",
    "nickname_taken",
    "nickname_invalid",
    "invalid_session",
    "already_answered",
    "not_accepting_answers",
    "time_expired",
    "room_closed",
    "activity_not_found",
    "not_authenticated",
    "prompt_required",
    "options_required",
    "correct_answer_required",
    "numeric_invalid",
    "type_invalid",
    "state_invalid",
    "confidence_invalid",
    "participant_not_found",
    "challenge_not_found",
    "activity_closed",
  ];
  for (const k of known) if (msg.includes(k)) return k;
  if (msg.toLowerCase().includes("fetch")) return "network_error";
  return msg.slice(0, 120) || "unknown_error";
}

type RpcResult<T> = { data: T | null; error: string | null };

async function call<T>(
  fn: string,
  args: Record<string, unknown>,
): Promise<RpcResult<T>> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { data: null, error: rpcError(error) };
  return { data: data as T, error: null };
}

/* ------------------------------------------------------------------ student */

export function joinRoom(code: string, nickname: string) {
  return call<JoinResult>("join_room", {
    p_code: code,
    p_nickname: nickname,
  });
}

export function getRoomState(token: string) {
  return call<StudentState>("get_room_state", { p_token: token });
}

export function submitAnswer(
  token: string,
  activityId: string,
  answer: (string | number)[],
  confidence?: number | null,
) {
  return call<{ accepted: boolean }>("submit_answer", {
    p_token: token,
    p_activity_id: activityId,
    p_answer: answer,
    p_confidence: confidence ?? null,
  });
}

export function setConfidence(
  token: string,
  activityId: string,
  confidence: number,
) {
  return call("set_confidence", {
    p_token: token,
    p_activity_id: activityId,
    p_confidence: confidence,
  });
}

export function submitChallenge(token: string, activityId: string, body: string) {
  return call("submit_challenge", {
    p_token: token,
    p_activity_id: activityId,
    p_body: body,
  });
}

/* ------------------------------------------------------------------ teacher */

export function createRoom(title: string) {
  return call<{ id: string; code: string; title: string }>("create_room", {
    p_title: title,
  });
}

export function closeRoom(roomId: string) {
  return call("close_room", { p_room_id: roomId });
}

export function getTeacherState(roomId: string) {
  return call<TeacherState>("get_teacher_state", { p_room_id: roomId });
}

export interface LaunchActivityInput {
  roomId: string;
  prompt: string;
  type: string;
  options: string[];
  correct: (string | number)[];
  timer: number;
  explanation?: string;
  difficulty?: string;
  topic?: string;
  questionId?: string | null;
}

export function launchActivity(i: LaunchActivityInput) {
  return call<{ id: string }>("launch_activity", {
    p_room_id: i.roomId,
    p_prompt: i.prompt,
    p_type: i.type,
    p_options: i.options,
    p_correct: i.correct,
    p_timer: i.timer,
    p_explanation: i.explanation ?? null,
    p_difficulty: i.difficulty ?? "Medium",
    p_topic: i.topic ?? null,
    p_question_id: i.questionId ?? null,
  });
}

export function setActivityState(roomId: string, state: string) {
  return call("set_activity_state", {
    p_room_id: roomId,
    p_state: state,
  });
}

export function closeActivity(roomId: string) {
  return call("close_activity", { p_room_id: roomId });
}

export function pauseTimer(roomId: string) {
  return call("pause_timer", { p_room_id: roomId });
}

export function setRoomSettings(roomId: string, settings: Record<string, unknown>) {
  return call("set_room_settings", {
    p_room_id: roomId,
    p_settings: settings,
  });
}

export function autoAssignTeams(roomId: string, teamCount: number) {
  return call("auto_assign_teams", {
    p_room_id: roomId,
    p_team_count: teamCount,
  });
}

export function setParticipantTeam(roomId: string, participantId: string, team: string) {
  return call("set_participant_team", {
    p_room_id: roomId,
    p_participant_id: participantId,
    p_team: team,
  });
}

export function decideChallenge(
  roomId: string,
  challengeId: string,
  approve: boolean,
) {
  return call("decide_challenge", {
    p_room_id: roomId,
    p_challenge_id: challengeId,
    p_approve: approve,
  });
}

export function getLeaderboard(roomId: string, mode: LeaderboardMode) {
  return call("leaderboard", {
    p_room_id: roomId,
    p_mode: mode,
    p_limit: 10,
  });
}

export function getSessionSummary(roomId: string) {
  return call<SessionSummary>("get_session_summary", { p_room_id: roomId });
}
