-- ===========================================================================
-- Rain of Physics - incremental DB update
-- Paste this into the Supabase SQL Editor and run it ONCE.
-- You do NOT need to re-run supabase/schema.sql.
--
-- Replaces public.submit_answer with a version that rejects non-numeric
-- submissions on a numerical question ('numeric_invalid', errcode 22023).
-- Without it a modified client can store arbitrary text such as "abc" and
-- pollute the live response distribution. An empty submission is still
-- tolerated and simply scores 0.
--
-- Idempotent: create or replace function is safe to re-run any time.
-- ===========================================================================
create or replace function public.submit_answer(
  p_token      text,
  p_activity_id uuid,
  p_answer     jsonb,
  p_confidence integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_pid    uuid;
  v_rid    uuid;
  v_act    public.activities%rowtype;
  v_room   public.rooms%rowtype;
  v_resp   public.responses%rowtype;
  v_exists public.responses%rowtype;
  v_now    timestamptz := now();
  v_elapsed numeric;
  v_window integer;
  v_bonus  integer := 0;
  v_points integer := 0;
  v_xp     integer := 0;
  v_correct boolean := false;
  v_was_correct boolean := false;
  v_streak_bonus integer := 0;
begin
  select id, room_id into v_pid, v_rid
    from public.participants
   where session_token_hash = public.hash_token(coalesce(p_token, ''));
  if v_pid is null then raise exception 'invalid_session' using errcode = '28000'; end if;

  select * into v_act from public.activities
   where id = p_activity_id and room_id = v_rid for update;
  if v_act.id is null then raise exception 'activity_not_found' using errcode = 'P0002'; end if;

  select * into v_room from public.rooms where id = v_rid;
  if v_room.status not in ('lobby','active') then
    raise exception 'room_closed' using errcode = 'P0001';
  end if;

  if v_act.state <> 'answering' then
    raise exception 'not_accepting_answers' using errcode = 'P0001';
  end if;

  if v_act.paused then
    raise exception 'not_accepting_answers' using errcode = 'P0001';
  end if;

  if v_act.deadline is not null and v_now > v_act.deadline + interval '900 milliseconds' then
    raise exception 'time_expired' using errcode = 'P0001';
  end if;

  -- Lock the participant row so streak/XP updates cannot race.
  perform 1 from public.participants where id = v_pid for update;

  select * into v_exists from public.responses
   where activity_id = v_act.id and participant_id = v_pid;
  v_was_correct := coalesce(v_exists.is_correct, false);

  if v_exists.id is not null and coalesce(v_room.settings ->> 'allow_change', 'false') <> 'true' then
    raise exception 'already_answered' using errcode = '23505';
  end if;

  v_window := coalesce(nullif(v_act.speed_window, 0), v_act.timer_seconds, 30);
  v_elapsed := extract(epoch from (v_now - coalesce(v_act.launched_at, v_now)));

  -- A numerical question only accepts numeric input. Without this a modified
  -- client could store arbitrary text and pollute the live distribution.
  -- An empty submission is tolerated (it scores 0), but "abc" is not.
  if v_act.type = 'numerical' then
    begin
      perform nullif(trim(coalesce(p_answer ->> 0, p_answer ->> 'value', '')), '')::numeric;
    exception when others then
      raise exception 'numeric_invalid' using errcode = '22023';
    end;
  end if;

  -- evaluate correctness on the server
  if v_act.type = 'numerical' then
    v_correct := public.is_numerical_correct(p_answer, v_act.correct_answer);
  else
    v_correct := (p_answer = v_act.correct_answer);
  end if;

  if v_correct then
    v_points := 100;
    v_bonus   := public.speed_bonus(v_elapsed, v_window);
    v_xp     := v_points + v_bonus;
  end if;

  if v_exists.id is null then
    insert into public.responses
      (activity_id, participant_id, room_id, answer, confidence, submitted_at,
       reaction_ms, is_correct, base_points, speed_bonus, xp)
    values
      (v_act.id, v_pid, v_rid, coalesce(p_answer,'[]'::jsonb), p_confidence, v_now,
       greatest(0, round(extract(epoch from (v_now - coalesce(v_act.launched_at, v_now))) * 1000)::int),
       v_correct, v_points, v_bonus, v_xp)
    returning * into v_resp;

    update public.participants
       set answered_count = answered_count + 1,
           correct_count  = correct_count + case when v_correct then 1 else 0 end,
           xp             = xp + v_xp
     where id = v_pid;
  else
    update public.responses
       set answer = coalesce(p_answer,'[]'::jsonb),
           confidence = p_confidence,
           submitted_at = v_now,
           is_correct = v_correct,
           base_points = v_points,
           speed_bonus = v_bonus,
           xp = v_xp,
           changed_count = changed_count + 1
     where id = v_exists.id
    returning * into v_resp;

    update public.participants
       set xp           = xp - v_exists.xp + v_xp,
           -- Same response, so answered_count is untouched — but accuracy must
           -- follow a corrected answer in either direction.
           correct_count = greatest(0, correct_count
                                    + (case when v_correct then 1 else 0 end)
                                    - (case when v_was_correct then 1 else 0 end))
     where id = v_pid;
  end if;

  -- Streaks (teacher may disable them per room). Only a *transition* to a
  -- correct answer advances the run, so re-submitting an unchanged answer
  -- (allow_change) cannot farm milestones.
  if coalesce(v_room.settings ->> 'streaks_enabled', 'true') = 'true' then
    if v_correct and not v_was_correct then
      update public.participants
         set streak = streak + 1,
             best_streak = greatest(best_streak, streak + 1)
       where id = v_pid
      returning streak into v_streak_bonus;

      v_streak_bonus := public.streak_milestone(v_streak_bonus);
      if v_streak_bonus > 0 then
        update public.participants set xp = xp + v_streak_bonus where id = v_pid;
        update public.responses set xp = xp + v_streak_bonus where id = v_resp.id;
        v_xp := v_xp + v_streak_bonus;
      end if;
    elsif not v_correct then
      update public.participants set streak = 0 where id = v_pid;
    end if;
  end if;

  return jsonb_build_object(
    'accepted', true,
    'submitted_at', v_resp.submitted_at,
    -- correctness is intentionally withheld until the teacher reveals
    'revealed', false,
    'xp_now', (select xp from public.participants where id = v_pid)
  );
end;
$fn$;
