# Kodama Village, Phase 0: Prototype (about 2 weeks)

You are building the first playable version of **Kodama Village** at **village.desker.dev**. Read `docs/village/SPEC.md` in full before doing anything. It is the source of truth; this prompt says what to build *in this phase* and in what order. If anything here conflicts with the spec, stop and ask me.

## Goal of this phase
Answer one question as cheaply as possible: **does a friend group actually study together in a shared pixel world?**

So Phase 0 is about *feel*, not features:

- Walking around should feel good.
- Seeing friends' kodamas at their desks should feel warm.
- Bubbles should feel light.
- Starting a focus timer next to friends should feel motivating.

Anything that doesn't serve that waits for Phase 1.

## Gate this phase must make possible
3 friend groups (3–6 students each) each study in their village 3+ times in one week. Build the analytics in Checkpoint 11 so I can measure this.

## Not in this phase
Creating villages in the UI, proper invite links, roles beyond owner/member, Do Not Disturb, Ask/questions, emotes, knock, group study sessions, adding Board items by hand, click-to-walk pathfinding, minimap, push notifications, block/report UI, decorating, Leaves, LINE. (The word filter and rate limits ARE in.)

---

## Checkpoint 0: Investigate and plan (no code)

Read the repo and write a plan back to me covering:

1. **Current stack:**
   - Frontend framework and build tool
   - The `api/` functions and how they're deployed
   - Database provider and ORM / query layer
   - Migration tool
   - The better-auth setup (cookie name, domain, session storage)
   - Analytics, if any
2. **Desker data I need to reuse.** File paths and table names for:
   - Users / profile
   - Tasks (title, course, kind of work, estimate, planned time)
   - Deadlines
   - Courses
   - Timer / focus sessions
   - Kodama stage
   - The planner's timing-validity logic (if `isValidTimingSample` exists)
   - The create-deadline code path
   - Push subscription storage
3. **Repo layout proposal** following SPEC §3.2, adapted to what exists. Explain how `packages/shared` and `packages/db` will be shared without breaking the current desker.dev build.
4. **Realtime server recommendation.** Compare these three for one room per village, ~50 users, private, with a token handshake:
   - Cloudflare Durable Objects (or PartyKit)
   - Colyseus on Fly.io
   - Supabase Realtime

   Cover: developer experience, cost drivers, cold start, hibernation, local dev, and how it reaches Postgres. Recommend one.
5. **Shared login plan** (SPEC §3.3), including exactly how local dev will work.
6. **Migrations** for Phase 0 tables: `village`, `village_member`, `village_chat_log`, `village_focus_session`, and `village_event` (skip `village_event` if analytics already exists). Show the SQL or ORM schema.
7. **Decisions to confirm.** A short list of anything you need from me (e.g. domain DNS, which Postgres, secret names).

**Stop and wait for my approval.**

---

## Checkpoint 1: Foundations

- Scaffold `apps/village` (Vite + React + TypeScript strict + Phaser 3), plus `packages/shared` and `packages/db` per the approved plan.
- `packages/shared`:
  - `constants.ts` with every value from SPEC §4.4
  - `keybindings.ts` from SPEC §5.1 (Phase 0 keys only, but structured for all)
  - `protocol.ts` with zod schemas for the Phase 0 messages in SPEC §10
  - `types.ts` (Presence, Status, Activity, ZoneId, etc.)
- **Shared login across subdomains:**
  - Cookie on `.desker.dev`
  - `village.desker.dev` added to trusted origins and CORS
  - Signed-out redirect to desker.dev sign-in with a safe `redirect` back (only `*.desker.dev` allowed)
- Village app routes:
  - `/`: village picker, listing villages I'm a member of
  - `/v/:slug`: the world
  - `/join/:slug`: join via secret key, see Checkpoint 2
- Env vars documented in `apps/village/.env.example`: `VITE_API_URL`, `VITE_REALTIME_URL`, `VILLAGE_ROOM_SECRET`, DB URL reuse.

**Done when:**
- Signing in on desker.dev and opening village.desker.dev (or the local equivalent) shows my name without signing in again.
- The existing desker.dev build and tests still pass.

---

## Checkpoint 2: Database and the temporary join flow

- Run the approved migrations.
- `scripts/village-seed.ts --name "Med Year 1 Study Den" --owner <email> --courses DTIP122,ANAT101` creates a village (template `snowy_campus`) and prints a **temporary join link**: `/join/<slug>?k=<random 24-char key>`.
  - The key is stored hashed in `village.settings.join_key_hash`.
  - This is replaced by real invites in Phase 1.
- `/join/:slug?k=…`:
  - Signs the user in if needed.
  - Checks the key.
  - Adds them as `member` (refuses past `VILLAGE_MAX_MEMBERS`).
  - Shows a 30-second kodama colour pick: 6 palette-swap colours, stored for now in `village_member` settings or a small jsonb; Phase 2 moves it to `village_kodama_appearance`.
  - Drops them into the world.
- API endpoints, in Desker's existing `api/` style:
  - `GET /api/village/mine`
  - `GET /api/village/:slug` (members only)
  - `POST /api/village/:slug/join`
  - `PATCH /api/village/:slug/me` (status_sharing, share_deadlines, colour)

**Done when:**
- I can create a village with the script, open the link in a second browser profile, and join as a member.
- A non-member gets a friendly "You're not in this village" page.

---

## Checkpoint 3: Realtime room and auth

- `POST /api/village/token { villageId }` returns a 10-minute signed token (SPEC §3.4) after checking membership.
- **Room server** (on the approved host):
  - One room per village id.
  - `hello` → verify token → `welcome` with the current state.
  - `joined` / `left` broadcast.
  - `ping` / `pong`.
  - The room hibernates or sleeps when empty.
- **Client `net/` module:**
  - Connect
  - Refresh the token at 8 minutes
  - Reconnect with backoff (0.5 s → 8 s)
  - A "Reconnecting…" pill
  - A fresh `welcome` replaces local state
- Both sides validate every message with the zod schemas. Unknown or invalid messages are dropped and logged; repeated abuse disconnects the client.

**Tests:**
- Token with a wrong signature, wrong village, or expired → refused.
- A non-member can't get a token.
- A protocol version mismatch gets the refresh message.

**Done when:** two browser profiles open the same village and each sees the other appear in a debug list.

---

## Checkpoint 4: The world (single player)

- **Placeholder assets.** `scripts/gen-placeholder-assets.ts` generates original pixel art PNGs plus `assets/manifest.json` (SPEC §11):
  - The tileset (snow ground, stone path, wooden floor, walls, windows, desks, chairs, shelves, lamp, tables, kotatsu, cushions, trees, fence, pond, Board)
  - Kodama sprite sheets in 6 colours (16×24; 4 directions × 3 walk frames, idle, sit, read, sleep)
  - A snowflake particle

  Simple but charming: rounded kodama body, two dot eyes, blush, a little leaf on top.
- **Map.** `public/maps/snowy_campus.json`, built per SPEC §4.2:
  - Tiled-compatible JSON with all the listed layers
  - About 40×28 tiles
  - Zones as rectangles in the `zones` layer
  - ~24 library desks + 16 table seats + lounge cushions in `sitSpots`, each with a stable id like `lib-desk-07`, `table-2-seat-3`
  - 8 spawn points around the Board

  Generate it with a script if hand-writing is impractical. The script is the source, so it can be regenerated.
- **Phaser `WorldScene`:**
  - Integer zoom, pixel-perfect rendering
  - Camera follow with lerp 0.12
  - y-sorted depth, with `furniture_above` drawn over kodamas
  - Collision grid from the `collision` layer
- **Local movement:**
  - WASD/arrows, one tile per step at `WALK_MS_PER_TILE`
  - Shift runs at `RUN_MS_PER_TILE`
  - Holding a key keeps walking
  - Turning to face a blocked tile works without moving
  - Walk animation in sync with steps
- **Ambience:**
  - Snowfall outdoors (skip indoor zones except near windows)
  - Day/night tint by local time (SPEC §4.3)
  - Idle blink and bob
- **HUD (React over the canvas):**
  - Village name
  - "?" help button and overlay listing the Phase 0 keys
  - First-visit hint strip
  - Settings gear: sound on/off, volume
- Game keys are ignored while any input has focus. Test this.

**Done when:**
- Walking around the whole map feels smooth at 60 fps.
- I can't walk through walls or furniture.
- Kodamas go behind and in front of desks correctly.

---

## Checkpoint 5: Multiplayer movement ⏸ STOP AND LET ME TEST

- **Client:**
  - Sends `move` at most `MOVE_SEND_MAX_HZ`, only while moving.
  - Local movement is predicted, so it never waits for the server.
- **Server:**
  - Validates each step: adjacent tile, walkable, rate ≤ run speed + 20%.
  - Batches `moved` every 50 ms.
  - Sends `correct` on violation.
- **Remote kodamas:**
  - Rendered `REMOTE_INTERP_DELAY_MS` behind, moving smoothly between received positions, with the right facing and walk animation.
  - If more than 3 tiles behind, they snap with a tiny dust puff.
- Name tags above every kodama (pixel font, small, with a subtle backing). Your own tag is slightly highlighted.
- Join and leave: a soft sparkle when a kodama appears at a spawn point, and a fade when they leave.

**Stop here.** Tell me exactly how to run everything locally (app + API + realtime + DB) and test with two browser profiles. I'll check the feel before you continue.

---

## Checkpoint 6: Bubbles

- T or Enter opens a small bubble box above the action bar:
  - 120-character counter
  - @mention autocomplete from members
  - Enter sends; Esc cancels
- **Server delivery rules exactly as SPEC §6.3:**
  - Radius
  - The "…" indicator for 5–12 tiles
  - Table-only delivery for seated senders
  - Library hiding with @mentions queued until focus ends (`queued` message)
- Word filter (Thai + English list in `packages/shared/wordfilter.ts`, masking with ★) and rate limit (5 per 10 s; over the limit, the box shakes gently with "Slow down a little").
- Bubble rendering:
  - Pixel-style rounded box with a tail, readable Thai-capable font
  - Pop-in, 8 s, fade
  - A new bubble replaces the old one
  - A soft blip sound if sound is on
- Zone chat log panel (button in the HUD): the last 24 h of what *you* were able to see, grouped by zone, with time and name. Rows are saved to `village_chat_log`; a scheduled purge deletes rows older than 24 h.

**Tests (pure functions):**
- Visibility for every rule combination
- Mention parsing
- Filter
- Rate limiter

**Done when:**
- Two players 4 tiles apart see each other's bubbles.
- At 8 tiles they see "…".
- In the Library they see nothing unless mentioned, and the mention arrives when focus ends.

---

## Checkpoint 7: Desks, sitting and presence

- X next to a sit spot sits down (snap to the spot, sit pose, facing set by the spot's property). X again, or any movement key, stands up.
- **Claim a desk:** sitting at an unclaimed library desk shows a small prompt, "Make this your desk? (X)". A claimed desk:
  - Shows a tiny name plate even when the owner is offline.
  - Is where you appear on your next visit, instead of a spawn point.

  One desk per member; claiming a new one releases the old one. Stored in `village_member.desk_spot_id`.
- **Presence:**
  - Available / Focusing / Away, per SPEC §6.1. DND is Phase 1.
  - Away after `AWAY_AFTER_IDLE_MS` of no input and no running timer. Sleeping pose with "zz".
  - Any input wakes you.
- **Member list (Tab):**
  - Online first, then offline with "last seen".
  - Each row: colour dot, name, presence icon, status text (respecting `status_sharing`), "at desk / in Library / Lounge…".
  - Clicking a name centres the camera on that kodama for 2 s. Locate only; Walk-to and Follow come in Phase 1.

**Done when:**
- Desks persist across visits.
- Friends see me sitting and see me fall asleep after 5 idle minutes.

---

## Checkpoint 8: Status and the focus timer (the Desker link)

- **Task picker.** Pressing F at your desk with no timer running opens a small panel:
  - Today's Desker tasks (from the existing Desker API or query layer), each showing title, course and planned duration.
  - A "Something else" option: pick an activity and type a short label.
  - Minutes default to the task's planned duration, editable.
- **Starting:**
  - Creates a **real Desker timer/focus session** through Desker's existing code path, plus a `village_focus_session` link row.
  - Sends `status` and `focus.start`; presence becomes Focusing.
  - A timer ring above the kodama shows progress to friends.
  - A small HUD timer shows time left, with Pause (if Desker supports pausing) and Stop.
- **Ending (F, Stop, or time up):**
  - Ends the Desker session the normal way.
  - Asks one quick question if Desker's flow does: "Done? / Still going".
  - Applies the valid-timing rules (SPEC §8.2) via the shared helper, so short or junk sessions don't teach Rhythm.
  - Time up plays a soft chime. Presence returns to Available.
- **Library auto-focus:**
  - With `village.settings.library_auto_focus = true` (default), entering the Library sets presence to Focusing (no timer).
  - Leaving sets it back, unless a timer is running.
- Status appears above the desk as an activity icon. The member list shows full text when `status_sharing = 'full'`, else "Studying".
- **Privacy settings panel** (from the gear):
  - Status sharing: Full / Basic / Off
  - Share my deadlines with this village: off by default
  - Library auto-focus (owner only)

**Tests:**
- Timing validity edge cases (4 min 59 s, 15% boundary, 6× boundary).
- Ending a village session creates exactly one Desker session.

**Done when:**
- A focus session started in the village shows up in desker.dev's planner and Rhythm exactly as if it had been started there.
- Friends see my timer ring.

---

## Checkpoint 9: The Board (read-only)

- The Board object stands in the Plaza. Standing next to it shows "X to read". B opens it anywhere.
- **Board panel:** a full-height side panel (bottom sheet on phones) with two columns, **Due this week** and **Exams**.
  - Each item: course code chip, title, day + time, countdown ("in 2 days"), urgency colour (SPEC §7), and small avatars of members who have it.
  - Items come from Desker deadlines of members with `share_deadlines = true`, whose course is in `village.course_tags`.
  - Merge items with the same course + normalised title + date within ±1 day into one item with several avatars.
- The room sends `board` on `welcome`, and again when a sharing member's deadlines change. Polling every 5 minutes is acceptable in Phase 0; a cleaner trigger comes later.
- An empty Board shows a friendly hint: "Share your deadlines in Settings so the village can see what's coming."
- In the world, the Board sprite shows a tiny red pin when something is due within 24 hours.

**Done when:** two members who share the same DTIP 122 deadline see one merged item with both avatars, in red when under 24 hours.

---

## Checkpoint 10: Phone basics

- Tap a walkable tile → the kodama walks there in straight-line steps (first horizontal, then vertical; stop at the first blocked tile). A* comes in Phase 1.
- Bottom action bar (shown on touch devices): **Talk**, **Sit/Stand**, **Focus**, **Board**, each with a pixel icon and label.
- Panels become bottom sheets. The bubble box sits above the keyboard.
- Zoom is chosen so about 15 tiles fit across a portrait screen. Pinch zoom is disabled.
- Respect safe-area insets. Test on iOS Safari and Android Chrome widths (375, 390, 412).

**Done when:** a friend on a phone can join, walk to a desk, sit, start a timer and send a bubble without a keyboard.

---

## Checkpoint 11: Analytics, deep link, polish and tests

- **Analytics:** fire the Phase 0 events in SPEC §13.
  - `session_minutes` is sent on leave and when the tab hides (`visibilitychange`, using `sendBeacon`).
  - Write `scripts/village-report.ts`, which prints per village per day:
    - Unique members
    - Sessions
    - Minutes present
    - Focus minutes
    - Bubbles
    - Whether 3+ members were present at the same time

    That is how I will check the gate.
- **desker.dev Today page:** add a "Study in the village" button that opens the last-visited village (stored per user), or the picker.
- **Polish:**
  - Footstep dust on run
  - Gentle camera ease when sitting
  - Hover tooltip over a kodama showing its status
  - Pausing the render loop when the tab is hidden
  - Lazy-loading Phaser so the picker loads fast
- **Load test:** `scripts/loadtest.ts --clients 30 --minutes 3` connects bots that walk randomly and chat. It reports server CPU/memory, message rates and dropped messages. Target: no drops, smooth for a real client watching.
- `apps/village/README.md`:
  - Architecture in 10 lines
  - Local dev setup
  - Env vars
  - How to seed a village
  - How to run the report
  - Deploy steps for Vercel and the realtime host
  - DNS for `village.desker.dev`

  Don't deploy anything yourself.
- Update the Status section in `docs/village/SPEC.md`.

---

## Demo script (I'll run this with friends at the end)
1. Seed a village and send the join link to the group's LINE chat.
2. Each friend joins, picks a colour, walks to the Library and claims a desk.
3. Everyone starts a 25-minute focus timer from a real Desker task.
4. Halfway through, one person @mentions another. It should arrive only when their timer ends.
5. Break: everyone walks to the Lounge and chats in bubbles.
6. Someone opens the Board and sees the shared deadlines.
7. Afterwards, check that every focus session appears in desker.dev's Rhythm.

## When you finish, report back with
1. What was built, checkpoint by checkpoint.
2. How to run it locally and how to deploy it.
3. Known issues and anything you simplified.
4. Your suggestions for Phase 1, based on what you saw while building.
