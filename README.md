# Rain of Physics — Live Classroom

A real-time, ephemeral, gamified classroom platform. A teacher opens a temporary
room, students join from their phones by QR or 6-character code with nothing but
a nickname, and the teacher fires off live questions. Every score is computed
**in Postgres** — the browser can never read the answer key or write a score.

## Setup

### 1. Apply the database schema (required, one time)

Open your Supabase project → **SQL Editor** → paste the entire contents of
[`supabase/schema.sql`](supabase/schema.sql) → **Run**.

The file is idempotent (safe to re-run). It creates the tables, RLS policies,
realtime publication, and every RPC the app calls. Nothing works until this step
is done — the client calls `join_room` / `get_room_state` / `submit_answer` and
will 404 until they exist.

> Students (`anon`) get **zero table privileges**. They talk to the database only
> through `SECURITY DEFINER` RPCs that authenticate a hashed per-participant
> session token from `localStorage`. Teachers (`authenticated`) get table access
> guarded by row level security.

**Already have a database?** Re-run `supabase/schema.sql` after pulling an
update. The file is idempotent, so it only refreshes functions/indexes/policies
and never touches your question bank, teachers or results.

### 2. Environment

`.env.local` already holds:

```   
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

### 3. Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

| Route | Who | What |
| --- | --- | --- |
| `/` | anyone | landing page |
| `/login` | teacher | email/password (confirmation is on, so it says "check your inbox") |
| `/dashboard` | teacher | question bank, topics, **Open a room** |
| `/room/[code]` | teacher | control centre: launch, distribution, reveal, pause, leaderboard, summary |
| `/room/[code]/display` | any screen | read-only smartboard mirror |
| `/join` | student | enter room code |
| `/join/[code]` | student | nickname gate → the whole game (mobile-first) |

## How a round flows

1. Teacher **opens a room** → `create_room()` issues a 6-char code from an
   unambiguous alphabet (no `0/O`, no `1/I/L`) and closes any previous room.
2. Students **join** → `join_room()` mints a 48-char token, stores only its
   SHA-256, and flips the room from `lobby` to `active`.
3. Teacher **launches** → the launch bar sits under the room, in the lobby as
   well as mid-question, and offers an *either/or*: **New question** opens the
   composer for something of their own, **Question set** opens the question
   paper *in the room, not as a modal* — pick a set, scroll every question it
   holds, click one and it goes live. `launch_activity()` closes any open
   question, starts the clock, and pushes a broadcast so every phone wakes up.
   The **Active Set / Launch Next in Set** bar then takes over and continues
   *after* the question you just launched — it never serves the head of the
   set twice.
4. Students **submit** → `submit_answer()` locks the participant row, grades on
   the server, and applies:
   - **100** base points for correct
   - **0–50** speed bonus by how early in the window the answer landed
   - streak milestones **3 → +20**, **5 → +50**, **10 → +100**
5. Teacher **shows the split** (`distribution`) — aggregate bars only, nobody's
   answer is exposed — then **reveals**, then the **per-question leaderboard**.
   That is the whole control bar: *Show responses → Reveal answer → Show
   question leaderboard* (there is no skip button). That board ranks only the
   students who answered *this* question, by the XP they earned on it
   (`public.question_leaderboard`). Room-wide standings stay on the teacher's
   screen throughout the lesson.
6. Teacher **ends the class** with **Final results** — the top-3 podium and the
   session leaderboard appear on the teacher's screen and on the projector.
   Only the projector celebrates: it fires a confetti burst (which honours
   `prefers-reduced-motion`) plus a short generated fanfare. Launching the
   next question clears the flag again.
7. **End class** closes the room and lands on the session summary — a
   **report card covering every student who joined**, not just the leaderboard's
   top ten: answered, correct, wrong, unattempted and XP, straight from
   `get_session_summary`. The same card is in the dashboard's room history.

Rooms that are still `lobby` or `active` keep **Live room** and **Display
mode** buttons on the dashboard, so a teacher who has left the admin screen can
get back in and can open the smartboard mirror on the projector's own browser.

A student who **closes the tab is out of the room**: their own page calls
`leave_room()` on the way out, so the name comes off every *In the room*
roster immediately (and a 45-second staleness check in `get_room_state` takes
the seat back when the browser never got to say goodbye). Their XP and every
answer they submitted are **kept** — `join_room()` recognises a seat that has
gone quiet and hands it back to whoever reuses that name, with a fresh session,
so rejoining means entering the name again rather than starting from zero.

Realtime is split deliberately: students hold no table privileges, so they use
**Broadcast + Presence** on `room:{id}` carrying only "refetch" signals; the
teacher uses **Postgres Changes** on `responses` / `participants` / `activities`.
Broadcast is a signal, never a source of truth — clients always re-read
authoritative state over RPC, so a forged message costs at worst an extra fetch.

## Checks

```bash
npm run build   # Next.js + TypeScript
npm run lint    # eslint src
```
