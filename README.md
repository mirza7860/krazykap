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
3. Teacher **launches** → `launch_activity()` closes any open question, starts
   the clock, and pushes a broadcast so every phone wakes up.
4. Students **submit** → `submit_answer()` locks the participant row, grades on
   the server, and applies:
   - **100** base points for correct
   - **0–50** speed bonus by how early in the window the answer landed
   - streak milestones **3 → +20**, **5 → +50**, **10 → +100**
5. Teacher **shows the split** (`distribution`) — aggregate bars only, nobody's
   answer is exposed — then **reveals**, then the **leaderboard**.
6. **End class** closes the room and lands on the session summary.

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
