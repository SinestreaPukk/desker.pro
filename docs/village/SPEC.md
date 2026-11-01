# Kodama Village: technical spec

> Source of truth for village.desker.dev. Every phase prompt refers to this file.
> If the code and this spec disagree, stop and ask the owner (Tiger). Don't silently change either.

---

## 1. Product summary

Kodama Village is a Gather.town-style 2D pixel world where university students study together with friends. Each student appears as their own **avatar**, a small person they will be able to customise (skin, hair, outfit) in a later phase. (Changed from the kodama after Checkpoint 5 feedback; the kodama stays Desker's companion, not the villager.) They walk around a shared world, claim a desk, show what they're studying, chat in short speech bubbles, run focus timers together, and see a central **Board** of homework and exam deadlines.

- **One-liner:** a study café for your friend group, run by your kodamas.
- **Design rule: quiet by default.** Studying is the main activity; chatting is for breaks. No voice or video.
- **Feel:** alive, cosy and calm. Gather.town's sense of place, but slower, softer and made for focus.
- **It is Desker made social, not a separate product.** Same login, same database, same tasks, deadlines and timers as desker.dev. Every village focus session makes the planner smarter.

### Why it matters (the moat)
1. **Network effect:** a friend group that studies here can't leave without studying alone again.
2. **Investment:** a world the group decorated together is hard to abandon (Phase 2).
3. **Shared course data:** deadlines on many village Boards become course intelligence (Phase 3).
4. **Attachment:** focus minutes grow each student's kodama and the village.

---

## 2. Glossary (use these words in code and UI)

| Term | Meaning | Code name |
|---|---|---|
| Village | A persistent world one student owns and invites friends into | `village` |
| Zone | A map area with its own rules: Plaza, Library, Tables, Lounge, Garden | `zone` |
| Kodama | A member's avatar | `kodama` / `avatar` |
| Desk | A seat a member claims; it remembers them | `desk` (a kind of `sitSpot`) |
| Sit spot | Any tile you can sit on: desk chair, table seat, lounge cushion | `sitSpot` |
| Status | What a member is doing now: subject, activity, task, time left | `status` |
| Presence | Available, Focusing, Do Not Disturb, Away | `presence` |
| Bubble | Short text floating above a kodama, seen nearby | `bubble` |
| Question | A bubble marked "?" that also pins to the Board | `question` |
| Board | The notice board in the plaza | `board` |
| Study together | A shared focus/break timer several members join | `groupSession` |
| Knock | A gentle "chat when free?" ping | `knock` |
| Leaves | Soft currency earned only from focus minutes (Phase 2) | `leaves` |
| Decor | Placeable objects (Phase 2) | `decor` |

---

## 3. Architecture

### 3.1 Deployment
| Part | Where | Notes |
|---|---|---|
| desker.dev (existing) | Vercel | Planner app + `api/` serverless functions |
| village.desker.dev (new) | Separate Vercel project, same repo | Vite + React shell + Phaser 3 canvas |
| Realtime server (new) | Chosen in Phase 0 Step 0: Cloudflare Durable Objects / PartyKit, Colyseus on Fly.io, or Supabase Realtime | One room per village. Holds live state in memory |
| Database | Existing Desker Postgres | New tables prefixed `village_`. Same DB, so planner data links directly |
| Assets | Served by the village app's CDN | Sprite sheets, tilesets, sounds, map JSON |

### 3.2 Repo layout (preferred; confirm in Phase 0 Step 0)
```
apps/
  web/                # existing desker.dev (move only if low-risk; otherwise leave in place)
  village/            # new: village.desker.dev
    src/
      app/            # React shell: routes, panels, HUD, settings
      game/           # Phaser: scenes, entities, input, rendering
      net/            # realtime client, protocol types, smoothing between updates
      board/          # Board panel UI
      assets/         # placeholder art + manifest.json
    public/maps/      # Tiled-compatible JSON maps
realtime/             # room server code
packages/
  shared/             # protocol types, zod schemas, constants (keybindings, timings), DB types
  db/                 # shared DB client + village_ queries (reuse the existing Desker DB layer)
docs/village/SPEC.md  # this file
```
If the current repo isn't a monorepo, propose the least disruptive way to share code (e.g. a `packages/` folder with path aliases) rather than a big restructure.

### 3.3 Shared login across subdomains
- better-auth with cross-subdomain cookies on `.desker.dev`, so one sign-in works on both desker.dev and village.desker.dev.
- Add `https://village.desker.dev` to better-auth trusted origins and to CORS on `api/`.
- Signed-out visitors to village.desker.dev go to desker.dev sign-in with `?redirect=` back to the village URL. Only allow redirects to `*.desker.dev`.
- Local dev must work, either with two localhost ports and a dev-only cookie setup, or `desker.test` / `village.desker.test` hosts. Document whichever is chosen.

### 3.4 Realtime auth
1. The village client calls `POST /api/village/token { villageId }` on the Desker API, with the session cookie.
2. The API checks the user is a member of that village (and not banned). It returns a signed token: `{ sub: userId, vid: villageId, role, exp: now+10min }`. Shared secret `VILLAGE_ROOM_SECRET`, HS256 (or EdDSA if the realtime host supports it easily).
3. The client connects to the room with the token. The room verifies the signature, expiry and `vid`, and refuses otherwise.
4. The client refreshes the token before it expires. On reconnect it fetches a new one.
5. Every message the room acts on is checked against the sender's role. **Never trust the client for permissions.**

### 3.5 Who is authoritative
- **The room server owns live state:** positions, presence, bubbles, sitting, group session timers.
- **The database owns lasting state:** villages, members, desks, Board items, questions, map versions, focus sessions, Leaves.
- The room writes lasting changes through the shared DB package (or calls the API). Pick one approach and use it everywhere.
- Movement is validated loosely on the server, enough to stop cheating, without lag:
  - The target tile must be next to the last known tile and walkable.
  - Rate is limited to the run speed plus 20% tolerance.
  - On a violation, the server sends a `correct` message with the true position.

---

## 4. The world

### 4.1 Rendering
- **Engine:** Phaser 3 (PixiJS only if justified in Phase 0). React renders all panels and HUD above the canvas.
- **Tiles:** 16×16 px, drawn at an integer zoom (3× desktop, 2× or 3× on phones, chosen to fit the screen). `pixelArt: true`, `roundPixels: true`. No blur.
- **Camera:** follows your kodama with slight lerp (0.12). Clamped to map bounds. Snapped to whole pixels.
- **Depth:** sort entities by y so kodamas walk behind and in front of furniture correctly.
- **Map format:** Tiled-compatible JSON with these layers:
  - Tile layers: `ground`, `floor`, `walls`, `furniture_below`, `furniture_above`
  - Object layers: `collision`, `zones`, `sitSpots`, `spawn`, `interactables` (board, doors, etc.)
- **Target:** 60 fps on a mid-range laptop with 30 kodamas on screen. Smooth on a recent mid-range phone. Rendering pauses when the tab is hidden.

### 4.2 Default map: "Snowy Campus"
About 40×28 tiles. Every zone is reachable in a few seconds' walk.

| Zone | Position | Contents | Rules |
|---|---|---|---|
| Board Plaza | Centre | The Board (3×2 tiles), 8 spawn points around it, benches, a lamp post, a small snowman | Normal bubbles. Arrival point |
| Library | Top-left | ~24 desks in rows, shelves, reading lamps, a big window | **Quiet zone:** entering turns Focus on (if the setting allows); bubbles hidden except @mentions, which are queued until focus ends |
| Group Tables | Top-right | 4 tables × 4 seats, a whiteboard prop, plants | Bubbles shared only with people seated at the same table |
| Lounge | Bottom-left | Kotatsu, cushions, tea counter, window with snowfall | Normal bubbles. Busiest at break time. "Break" lighting during group-session breaks |
| Garden | Bottom-right | Snowy trees, stone path, a pond, a frozen bench | Normal bubbles. Phase 3: one tree per finished course |

Dashed paths connect the Plaza to each zone. The outer edge is trees, snow banks and a fence, so nothing feels walled-in.

### 4.3 Ambience
- Gentle snowfall particles, denser outdoors, a few visible through windows indoors.
- Warm window glow and lamp light pools.
- Day/night tint follows the viewer's local time (default Asia/Bangkok):
  - Dawn 05:30–07:00
  - Day
  - Dusk 17:30–19:00
  - Night: lamps on
- Idle life: kodamas blink every 3–6 s at random and bob gently. Tea steams. A bird hops in the Garden. Nothing flashes.
- **Sound** is optional and soft: footstep ticks (very quiet), bubble blip, chime for breaks, ambient wind/fire loop.
  - Master mute + volume slider.
  - Sound is off by default the first time, with a small "Turn on cosy sounds?" prompt.
  - Muted when the tab is hidden.

### 4.4 Movement and timing constants
Put these in `packages/shared/constants.ts`. Never use magic numbers in the code.
| Constant | Value |
|---|---|
| `WALK_MS_PER_TILE` | 150 |
| `RUN_MS_PER_TILE` (Shift) | 90 |
| `MOVE_SEND_MAX_HZ` | 10 |
| `REMOTE_INTERP_DELAY_MS` | 100 |
| `BUBBLE_MAX_CHARS` | 120 |
| `BUBBLE_VISIBLE_MS` | 8000 |
| `BUBBLE_RADIUS_TILES` | 5 (Euclidean, from tile centres) |
| `BUBBLE_RATE_LIMIT` | 5 per 10 s per user |
| `AWAY_AFTER_IDLE_MS` | 300000 (5 min without input or an active timer) |
| `CHAT_LOG_TTL_HOURS` | 24 |
| `VILLAGE_MAX_MEMBERS` | 50 |
| `DEFAULT_GROUP_FOCUS_MIN` / `DEFAULT_GROUP_BREAK_MIN` | 50 / 10 |
| `TOKEN_TTL_S` | 600 |

---

## 5. Controls

### 5.1 Desktop keybindings
Defined once in `packages/shared/keybindings.ts`, with a settings screen to remap them in Phase 1. **All game keys are ignored while any text input has focus.**

| Key | Action | Phase |
|---|---|---|
| W A S D / arrow keys | Walk freely in any of 8 directions (two keys make a diagonal; same speed in every direction). A small box around the feet slides along walls | 0 |
| Shift (held) | Run | 0 |
| T or Enter | Open the bubble box. Enter sends, Esc cancels | 0 |
| X | Interact: sit/stand at a sit spot, read the Board, open a door | 0 |
| F | At your desk: start/stop focus timer. Elsewhere: toggle Focusing presence | 0 |
| Tab | Show/hide the member list | 0 |
| B | Open the Board panel | 0 |
| Esc | Close the top panel or input | 0 |
| Q | Ask a question (a "?" bubble, also pinned to the Board) | 1 |
| G | Toggle Do Not Disturb | 1 |
| E | Emote wheel; then 1–8 to pick | 1 |
| M | Show/hide the minimap | 1 |
| Click on map | Walk there (A* pathfinding) | 1 |
| Click a member in the list | Locate · Walk to · Follow · Wave · Knock | 1 |
| ? | Show the keyboard help overlay | 0 |
| Ctrl/Cmd + B | Build mode (owner/permitted members) | 2 |

First visit: a dismissible hint strip, "WASD to walk · T to talk · X to sit · ? for help".

### 5.2 Phone and tablet
- Tap a tile to walk there (Phase 0: straight-line steps; Phase 1: A*).
- Optional virtual joystick, bottom-left, shown when the screen is touched and held.
- Bottom action bar: **Talk**, **Sit/Stand**, **Focus**, **Emote** (P1), **Board**.
- Panels open as bottom sheets. Portrait first. Respect `env(safe-area-inset-*)`.

---

## 6. Presence, status and bubbles

### 6.1 Presence states
| State | How you get it | What others see | What reaches you |
|---|---|---|---|
| Available | Default | Idle kodama | Bubbles, questions, waves, knocks |
| Focusing | Timer running, or F, or entering the Library | Book pose, small timer ring above head | Only @mentions and knocks, **queued** until focus ends |
| Do Not Disturb (P1) | G | Headphones + small "shh" sign | Nothing until you turn it off |
| Away | 5 min idle with no timer | Sleeping at desk, "zz" | Nothing. Member list shows "away 12m" |

### 6.2 Status
- Shape: `{ courseCode?: string, activity: 'reading'|'practising'|'writing'|'revising'|'lab_report'|'group_work'|'admin'|'other', taskId?: string, taskTitle?: string, endsAt?: ISO }`
- Activities match Desker's kinds of work. Reuse Desker's existing enum if there is one.
- Picking a Desker task fills `courseCode`, `activity`, `taskTitle` automatically. Typing a status by hand is allowed.
- Per-village sharing choice (`status_sharing`):
  - `full`: everything
  - `basic`: shows "Studying" only (default)
  - `off`: no status at all
- Display: small activity icon above the desk/kodama; full text in the member list and on hover.

### 6.3 Bubbles
- Up to 120 characters, plain text only. Strip control characters; render as text, never HTML.
- Pop-in animation (scale 0.6 → 1, 120 ms), stays 8 s, then fades out over 300 ms. A new bubble from the same person replaces the old one.
- Who sees it is decided **on the server**:
  1. Sender in a Group Table seat → only people seated at that table.
  2. Sender or receiver in the Library → hidden, except @mentions (queued until the receiver's focus ends).
  3. Otherwise → receivers within `BUBBLE_RADIUS_TILES`.
  4. Receivers outside the radius but within 12 tiles see a "…" indicator over the sender.
  5. Never delivered to anyone who has blocked the sender (P1).
- Every delivered bubble is added to that zone's chat log (24 h TTL), which can be read in a side panel.
- @mention = `@` + display name. Autocomplete from the member list in the bubble box.

---

## 7. The Board

- The Board is a 3×2 interactable in the Plaza. Press X next to it, or B anywhere, to open the full panel.
- Columns: **Due this week** · **Exams** · **Questions** (P1) · **Announcements** (P1).
- Urgency colours: calm blue normally, amber within 3 days, red within 24 hours. Past items disappear 24 h after their date.
- **Phase 0:** read-only, filled automatically from deadlines of members who opted in (`share_deadlines = true`), for courses in the village's `course_tags`.
- **Phase 1:**
  - Members add due dates and exams by hand.
  - "I have this too" confirms an item.
  - Duplicates merge: same course + normalised title + date within ±1 day → one item with a confirm count.
  - **Add to my planner** creates a deadline in the user's Desker account, using Desker's own create-deadline code path, never a copy of it.
- Each item shows course, title, date/time, countdown, and who added or confirmed it (avatars).

---

## 8. Desker integration rules

1. **One timer.** A village focus session is a normal Desker focus/timer session. Store the link in `village_focus_session`. Don't add columns to Desker's table without asking.
2. **Valid timing rules** (same as the planner's Rhythm): a session teaches Desker about the student's pace only if:
   - Actual time ≥ 5 min
   - Actual time ≥ 15% of the estimate
   - Actual time ≤ 6× the estimate
   - It is not inside a user-ignored period

   Reuse the planner's `isValidTimingSample` helper if it exists; if not, create it in `packages/shared` and use it in both apps.
3. **Kodama appearance and growth stage** are read from the Desker profile. Phase 2 adds `village_kodama_appearance` for cosmetics.
4. **Deep link:** add a "Study in the village" button on the desker.dev Today page. It opens the user's last-visited village, or the village picker.
5. **Weekly report:** include "studied with friends: Xh" once the data exists (Phase 1).
6. **Privacy:** village data is included in Desker's existing export and delete-account flows.

---

## 9. Data model

All new tables are prefixed `village_`. Use UUID primary keys, `created_at timestamptz default now()`, and soft delete (`deleted_at`) where noted. Use the project's existing migration tool. Each phase file lists which tables it adds.

| Table | Phase | Key columns |
|---|---|---|
| `village` | 0 | id, slug (unique), name, owner_id → user, template ('snowy_campus'), course_tags text[], settings jsonb (`library_auto_focus`, `who_can_invite`, `who_can_build`), created_at, deleted_at |
| `village_member` | 0 | village_id, user_id (PK pair), role ('owner'\|'admin'\|'member'\|'guest'), desk_spot_id null, status_sharing ('full'\|'basic'\|'off'), share_deadlines bool default false, joined_at, last_seen_at, banned_at null |
| `village_chat_log` | 0 | id, village_id, zone_id, sender_id, text, mentions uuid[], created_at. Purge older than 24 h with a scheduled job |
| `village_focus_session` | 0 | id, village_id, user_id, desker_session_id → Desker timer row, group_session_id null, started_at, ended_at |
| `village_event` | 0 | id, village_id, user_id, name, props jsonb, created_at. Analytics, unless Desker already has an analytics tool, in which case use it |
| `village_invite` | 1 | code (unique, 10 chars), village_id, created_by, expires_at null, max_uses null, uses int, revoked_at null |
| `village_board_item` | 1 | id, village_id, kind ('due'\|'exam'\|'announcement'), course_code, title, title_norm, due_at, created_by, source ('manual'\|'auto'), source_ref null, merged_into null, created_at, deleted_at |
| `village_board_confirm` | 1 | item_id, user_id (PK pair), created_at |
| `village_question` | 1 | id, village_id, course_code null, text, author_id, created_at, resolved_at null, deleted_at |
| `village_answer` | 1 | id, question_id, author_id, text, created_at, deleted_at |
| `village_group_session` | 1 | id, village_id, started_by, focus_min, break_min, rounds, started_at, ended_at |
| `village_group_participant` | 1 | group_session_id, user_id, joined_at, left_at |
| `village_block` | 1 | blocker_id, blocked_id (PK pair), created_at |
| `village_report` | 1 | id, village_id, reporter_id, target_user_id, reason, context jsonb, created_at, resolved_at |
| `village_push_subscription` | 1 | Reuse Desker's push subscription table if one exists |
| `village_map_version` | 2 | village_id, version int, layers jsonb, created_by, created_at (PK village_id+version) |
| `village_placement` | 2 | id, village_id, decor_id, x, y, rotation (0/90/180/270), placed_by, created_at, removed_at |
| `village_decor_item` | 2 | id (slug), name, size_w, size_h, walkable bool, sit_spots jsonb, price_leaves int, season null, pack null |
| `village_leaves_ledger` | 2 | id, user_id, delta int, reason ('focus'\|'purchase'\|'goal_reward'\|'refund'), ref, created_at. Balance = sum. Never stored as a mutable number |
| `village_cosmetic_owned` | 2 | user_id, item_id (PK pair), acquired_at |
| `village_kodama_appearance` | 2 | user_id PK, base, colour, face, equipped jsonb |
| `village_goal` | 2 | id, village_id, period_start, period_end, target_minutes, reward_decor_id null |
| `village_line_link` | 2 | user_id PK, line_user_id, linked_at |
| `village_public_hall` | 3 | id, faculty, name, capacity, shard_count |
| `village_course_stat` | 3 | course_code, item_key, n, median_minutes, p80_minutes, updated_at (only published when n ≥ 5) |
| `village_purchase` | 3 | id, user_id, provider, provider_ref, sku, amount_satang, currency, status, created_at |
| `village_entitlement` | 3 | user_id, sku, granted_at, expires_at null |

Indexes: every foreign key; `village_board_item(village_id, due_at)`; `village_chat_log(village_id, created_at)`; `village_member(user_id)`.

---

## 10. Realtime protocol

- JSON messages `{ t: string, ...payload }`, validated with zod schemas in `packages/shared/protocol.ts` on **both** ends.
- Include `v: 1` in `hello`. The server refuses unknown versions with a "please refresh" message.

### Client → server
| t | Payload | Phase |
|---|---|---|
| `hello` | `{ v, token }` | 0 |
| `move` | `{ x, y, dir: 'up'\|'down'\|'left'\|'right', seq }` | 0 |
| `say` | `{ text }` | 0 |
| `sit` / `stand` | `{ spotId }` / `{}` | 0 |
| `status` | `{ status }` (see 6.2) | 0 |
| `presence` | `{ presence: 'available'\|'focusing'\|'dnd' }` | 0 (dnd: 1) |
| `focus.start` / `focus.stop` | `{ taskId?, plannedMin }` / `{}` | 0 |
| `claimDesk` | `{ spotId }` | 0 |
| `ask` | `{ text, courseCode? }` | 1 |
| `emote` | `{ id: 1..8 }` | 1 |
| `knock` | `{ userId }` | 1 |
| `group.start` / `group.join` / `group.leave` | `{ focusMin, breakMin, rounds }` / `{ id }` / `{}` | 1 |
| `build.place` / `build.remove` / `build.rotate` | `{ decorId, x, y, rotation, baseVersion }` / `{ placementId, baseVersion }` / … | 2 |
| `ping` | `{ ts }` | 0 |

### Server → client
| t | Payload | Phase |
|---|---|---|
| `welcome` | `{ self, members[], positions{}, presence{}, statuses{}, desks{}, board, mapVersion }` | 0 |
| `joined` / `left` | `{ member }` / `{ userId }` | 0 |
| `moved` | `{ userId, x, y, dir, seq }` (batched every 50 ms) | 0 |
| `correct` | `{ x, y }` | 0 |
| `said` | `{ userId, text, zoneId }` or `{ userId, nearbyOnly: true }` for the "…" indicator | 0 |
| `sat` / `stood` | `{ userId, spotId }` / `{ userId }` | 0 |
| `statusChanged` / `presenceChanged` | `{ userId, status }` / `{ userId, presence }` | 0 |
| `focusChanged` | `{ userId, endsAt \| null }` | 0 |
| `board` | `{ items[] }` (full or delta) | 0 |
| `queued` | `{ items[] }` (mentions/knocks delivered after focus ends) | 0 |
| `asked` / `answered` | `{ question }` / `{ answer }` | 1 |
| `emoted` | `{ userId, id }` | 1 |
| `knocked` | `{ fromUserId }` | 1 |
| `group` | `{ session \| null, phase: 'focus'\|'break', phaseEndsAt }` | 1 |
| `mapPatch` | `{ version, ops[] }` | 2 |
| `error` | `{ code, message }` | 0 |
| `pong` | `{ ts }` | 0 |

Reconnect: exponential backoff (0.5 s → 8 s max) with a "Reconnecting…" pill. On reconnect, a fresh `welcome` replaces local state.

---

## 11. Art direction

- Calm, cold, snowy, slightly Japanese pixel art, matching desker.dev. Not too saturated.
- **Palette:** about 32 colours, shared with the app UI. Snow whites, soft blues, slate, muted greens, wood browns, one warm lantern amber used for light and urgency.
- **Kodama sprite:** 16×24 px. 4 directions × 3 walking frames, plus idle (2 frames), sit, read (2 frames), sleep, and 8 emote overlays. Colour variants via palette swap.
- **Text:** pixel font for names, labels and headings only. Bubbles, Board and panels use a readable font that supports Thai (e.g. IBM Plex Sans Thai or Noto Sans Thai).
- **Placeholder art:** generate simple original placeholders with a script (`scripts/gen-placeholder-assets.ts`) and list every asset in `assets/manifest.json` (`key`, `file`, `frameWidth`, `frameHeight`, `animations`), so an artist can replace files without code changes.
- **Never copy or imitate Gather.town's art or any copyrighted asset.** Free asset packs are allowed only with a licence for commercial use, recorded in `assets/LICENSES.md`.

---

## 12. Safety and privacy
- Villages are private and invite-only. The room and the API both check membership on every action.
- Rate limits: bubbles (5 per 10 s), questions (3 per min), Board posts (10 per hour), knocks (1 per target per 2 min).
- Thai + English word filter on bubbles, questions, answers and Board titles (mask with ★). Keep the word list in a config file.
- Block (P1): the blocked person's kodama and messages disappear for the blocker. Report (P1): stored for the owner and for Desker admins.
- No voice, video, screen sharing or recording. Chat logs are deleted after 24 h.
- Render all user text as text (no `dangerouslySetInnerHTML`). Validate every message with zod.
- Thailand's PDPA: village data is included in Desker's export and delete flows. The privacy page gets a "Kodama Village" section (Phase 1).

---

## 13. Analytics events
Use Desker's existing analytics tool if there is one; otherwise use `village_event`. Never put message text in events.

| Event | Props | Phase |
|---|---|---|
| `village_opened` | villageId, device | 0 |
| `village_joined` | villageId, via ('link'\|'seed') | 0 |
| `desk_claimed` | villageId | 0 |
| `bubble_sent` | villageId, zoneId, length | 0 |
| `focus_started` / `focus_completed` | villageId, plannedMin, actualMin, valid | 0 |
| `board_opened` | villageId | 0 |
| `session_minutes` | villageId, minutes, focusMinutes (sent on leave) | 0 |
| `invite_created` / `invite_accepted` | villageId | 1 |
| `board_item_added` / `board_item_to_planner` | villageId, kind | 1 |
| `question_asked` / `question_answered` | villageId | 1 |
| `group_session_started` / `group_session_joined` | villageId, size | 1 |
| `decor_placed` / `leaves_earned` / `leaves_spent` | villageId, amount | 2 |

**North-star metric:** minutes studied together per active student per week.

---

## 14. Engineering conventions
- TypeScript strict everywhere. Protocol and constants are shared, never duplicated.
- Game logic that can be tested without Phaser lives in pure functions:
  - Pathfinding
  - Bubble visibility
  - Zone lookup
  - Collision
  - Board dedupe
  - Timing validity
- Tests: unit tests for pure functions, integration tests for room auth and permissions, and a load-test script (`scripts/loadtest.ts`) that simulates N clients walking and chatting in one room.
- Feature flags for anything half-built (`VILLAGE_FLAGS` env var).
- Small commits, one checkpoint at a time. Don't deploy to production. The owner deploys.

---

## Status
_(Claude Code updates this section after each checkpoint: what's done, what's left, known issues.)_

### Checkpoint 1: foundations (done)
- apps/village (Vite, React, strict TS, Phaser lazy-loaded), packages/shared (constants, keybindings, zod protocol, types, safeRedirect), packages/db.
- Shared login: cookie on COOKIE_DOMAIN, CORS for VILLAGE_ORIGINS, `?redirect=` allowed only to *.desker.dev / *.desker.test.
### Checkpoint 2: database and join flow (done)
- db/migrations/005_village.sql (5 tables, applied only to the Neon branch `village-dev`). Seed script, join page, API (`mine`, `:slug`, `:slug/join`, `:slug/me`).
- Deviation to confirm: kodama colour is stored in `village_member.settings` (jsonb), as the phase prompt allows.
### Local dev (important)
- Do NOT use `vercel dev` for village work: it applies the Vercel project's cloud env over .env.local, so it silently used the production database.
- Use `npm run dev:local` (Desker on desker.test:3000) and `npm run dev -w @desker/village` (village.desker.test:5174). Both read only `.env.local` via scripts/dev-api.js.
- Known issue: one test account (village-test-b278e9@desker.test) was created in the production database by mistake and must be deleted by the owner.
### Checkpoint 3: realtime room and auth (done)
- `POST /api/village/token`: member-only, 10-minute HS256 token (packages/shared/src/token.js, Web Crypto, shared by API and Worker).
- realtime/: Cloudflare Worker + one Durable Object per village (WebSocket Hibernation, SQLite-backed class). hello -> welcome, joined/left, ping/pong; wrong signature / wrong village / expired -> refused; protocol mismatch -> "please refresh"; junk dropped, 10 bad messages a minute disconnects; one connection per person (newest wins); sockets that never say hello are closed after 10 s.
- Client net/connection.ts: token refresh at 8 min, reconnect backoff 0.5 s -> 8 s, "Reconnecting..." pill, fresh welcome replaces state.
- Spec extension to confirm: the token also carries `n` (display name) and `c` (colour) so the room can list members without calling the API. Display only; permissions still come from `role`.
- Run: `npm run dev -w @desker/realtime` (needs realtime/.dev.vars with VILLAGE_ROOM_SECRET), `node scripts/room-smoke.mjs` checks it live.
- Not done / owner: deploying the Worker (needs `wrangler login` + `wrangler secret put VILLAGE_ROOM_SECRET`), and setting ALLOWED_ORIGINS for production.
### Checkpoint 4: the world, single player (done)
- Art: `node scripts/gen-placeholder-assets.ts` (tileset with 1px extruded tiles, 6 kodama colours 16x24, snowflake, lamp glow, assets/manifest.json). Map: `node scripts/gen-snowy-campus.ts` (40x28, all SPEC §4.2 zones, 24 desks, 16 table seats, 8 cushions, 8 spawns around the Board). Both are the source of the committed PNG/JSON.
- Pure logic with tests (packages/shared): map parsing, collision, stepping, zones, reachability (every seat, door and zone reachable), day/night, held keys (game keys ignored while typing).
- Phaser WorldScene: integer zoom (3x wide, 2x narrow), camera follow lerp 0.12, y-sorted depth, tile-by-tile walking at WALK/RUN_MS_PER_TILE, turning on blocked tiles, blink + bob, outdoor-only snow, day/night tint by local time (`?hour=21` previews), lamp glow, tea steam. Measured 60 fps steady in Chrome.
- HUD in React: village name, zone, help overlay (?), first-visit hint, settings (sound prefs; sounds themselves come with bubbles).
- Fixed: faint seams at zoom 3 came from an odd-height canvas, so the canvas is always snapped to even pixels.
- Simplified / not yet: snow near indoor windows, the Garden bird, sounds, pixel font for names (Checkpoint 5), integer zoom on non-integer-DPR displays.
### Checkpoint 5: multiplayer movement (done, awaiting owner's feel test)
- Client sends `move` at most MOVE_SEND_MAX_HZ (10/s) and only after something changed; local walking is predicted and never waits for the room.
- Room validates each update (shared `applyMove`): reachable by walking within a token budget that refills at run speed +20% (burst 3), else `correct` with the true tile. Batches `moved` every 50 ms, to everyone except the mover. Tested live: teleport refused, speed hack refused, legit steps delivered.
- Remote kodamas: drawn REMOTE_INTERP_DELAY_MS behind, walks scheduled to start on arrival and last as long as the real steps (smooth, never faster than running), snap with a dust puff if more than 3 tiles behind. Measured: no frame faster than run speed, 0 room corrections while running/walking ~35 tiles.
- Name tags in VT323 (own tag highlighted amber), soft sparkle + fade-in on arrival, fade-out on leave. `spawnFor(userId)` is shared so room and client agree where people appear.
- Fixed on the way: a closed connection could still open a socket after its token loaded and kick the live one out ("Opened in another tab").
- Not yet: `joined` carries no position (a new person appears at their spawn point; the next `moved` fixes any difference), sounds.

### Checkpoint 5 feedback pass (after the first hands-on test)
- **Free walking, 8 directions.** Movement is no longer tile-by-tile: keys set a direction, you move at a fixed speed (diagonals normalised) and a feet box (0.56 x 0.4 tile) slides along walls. The client sends fractional positions (tile-centred coordinates) at most 10 Hz; the room validates the tile you are in with an 8-neighbour no-corner-cutting path check (diagonal costs one token, so a cheater gains at most ~1.4x on diagonals; octile cost if that ever matters).
- **Avatar, not kodama.** Layered, tinted at runtime: body (skin), outfit, face, hair (short or long). Skin, hair and style derive from the user id for now (`appearanceFor`); the customiser replaces that later. The outfit tint is the member's colour.
- **Sitting pulled forward from Checkpoint 7.** X sits on a free spot next to you (in front first), X or any walking key stands; the room tracks `sat`/`stood`, refuses far or taken spots with `correct`, and `welcome` now carries `sitting`. Added spot kinds: bench, sofa, log (campfire). Desk *claiming* is still Checkpoint 7.
- **Remote smoothness.** Everyone else is drawn behind real time by an adaptive delay (100 ms minimum, grows to 250 ms to fit that person's update rhythm), so they never stall between updates.
- **World art.** New tileset (roofs, wall faces with windows/posters/clock/banners, per-room floors, rugs, autotiled cobble paths and pond, pines, stone lanterns, a torii and shrine, campfire with log seats, sofa, stove, vending machine). Same zones, desks, seats, spawns and Board position as before; walls are one tile, with a roof row above.

### Checkpoint 6: bubbles (done)
- T or Enter opens the bubble box (120-char counter, @mention autocomplete with Tab/Enter/click, Enter sends, Esc cancels; IME-safe). Bubbles render in Phaser with a Thai-capable font stack, pop in over 120 ms, stay 8 s, fade over 300 ms, and a new one replaces the old. A mention to you is amber. "…" shows for people 5-12 tiles away.
- Rules live in `packages/shared/src/bubbles.ts` (`visibility`, `parseMentions`, `cleanBubble`, `rateCheck`) and `wordfilter.ts` (Thai + English, masks with ★), tested in `bubbles.test.ts`. The room applies them: table seats talk only to that table; the Library is quiet except @mentions, which are held in the receiver's socket (max 3) and delivered as `queued` when they leave the Library; everyone else by distance.
- Rate limit 5 per 10 s: the room answers `error slow_down`, and the box comes back shaking with "Slow down a little" and your text.
- **Deviation to confirm:** the 24 h zone chat log is stored in the room's own SQLite (one row per person who could see a bubble, purged by an alarm and filtered on read), not in Postgres `village_chat_log`. Reason: the Worker then needs no database credentials and a bubble costs no network call to Postgres. The Postgres table is unused for now. Say if you want it in Postgres instead.
- Until Focus exists (Checkpoint 8), "focus ends" means "you left the Library". Blip sound plays when someone nearby speaks, only if cosy sounds are on.
- Added messages: client `log`; server `log {items}`; `said.mentionsYou`; `queued` items carry `name`.


## Checkpoint 7: desks, presence, member list (done)
- Desks: sit at a `lib-desk-NN` and press X to claim it. The API (`PUT /:slug/desk`, unique index `village_member_desk`) is authoritative and answers 409 `taken`; the room only checks the sender is seated there, then broadcasts `deskClaimed`. A member with a desk arrives sitting at it.
- Token: new claim `d` (desk spot id) next to `n` and `c`.
- Presence: available / focusing / away. F toggles focusing; entering the Library auto-focuses. Idle away applies only to `available` until the focus timer exists (Checkpoint 8). Away shows the sleep frame and "z z"; any input wakes. Focusing shows an amber ring and the book frame.
- Members panel (Tab): online first, then offline with last seen; click to locate.
- Migration `006_village_desk.sql` is a file only for production; applied to the Neon `village-dev` branch.

## Checkpoint 8: status and the focus timer (done)
- **F** at a desk with no timer opens the task picker (today's open Desker tasks, or "Something else" with an activity and a label; minutes default to the task's plan). With a timer running, F or Stop asks "Done? / Still going". Elsewhere F still toggles Focusing.
- **One Desker session.** Desker has no server-side running timer (its Focus screen writes when a sitting ends), so the village does the same: `POST /api/village/:slug/focus` `start` records a `village_focus_session` row, and `end` writes into the account document through `apps/village/api/village/_session.js`: one `rhythm.sessions` entry, hours added to the task's `spent`, and for Done a task `doneAt` plus an outcome. Validity is `invalidReason` from `src/rhythm.js` (>= 5 min, >= 15% and <= 6x of the estimate, not in an ignored period), so short or forgotten timers are logged but teach nothing. Ending twice writes once. Repeating tasks only get the time logged (Desker's own rollover stays in the app). With Rhythm learning off nothing reaches `rhythm`.
- **Pause / Resume** freezes the countdown and friends' ring (`focus.pause`, `focus.resume`, `pausedAt` on `focusChanged` and `welcome.focus`); paused time is not counted in the logged minutes and the pause count is saved on the Desker session.
- **Deviations:** `focusChanged` carries epoch ms `endsAt` plus `startedAt` so friends can draw the ring's progress, and `welcome` has a `focus` map. Token claim `s` (status sharing) added; changing the sharing setting reloads the page so the claim refreshes.
- **Status sharing** is applied in the room (`maskStatus`): full = everything, basic = a generic "Studying", off = nothing. The activity icon sits above the avatar; the member list shows the text and minutes left.
- **Quiet while timing.** A running timer is as quiet as the Library: only @mentions, queued, and handed over when the timer ends (outside the Library) or when leaving the Library (no timer).
- A running timer survives a reload (localStorage) and is re-announced after every reconnect. Time up plays a soft chime if cosy sounds are on.
- **Privacy panel** (gear): status sharing, share deadlines, and Library auto-focus (owner; others pick it up after a reload).

## Checkpoint 9: the Board, read-only (done)
- B opens the panel anywhere; X beside the Board in the Plaza shows "X  read the board". A side panel, a bottom sheet under 640 px wide. Two columns: Due this week (7 days) and Exams (60 days; a title with exam / midterm / final / quiz / test / สอบ). Items show the course chip, day and time, countdown, urgency colour (SPEC §7: red under 24 h, amber under 3 days, blue) and the avatars of members who have it. An empty Board shows the "Share your deadlines in Settings" hint. A small red pin appears on the Board in the world while something is due within 24 hours.
- Source: `GET /api/village/:slug/board` reads the `deadlines` of members with `share_deadlines = true`, keeps the village's `course_tags`, and merges (same course + normalised title + date within 1 day) through `packages/shared/src/board.js` (plain JS like `token.js`, with `board.d.ts`). Items more than 24 h past are dropped.
- **Deviations:** the client polls the API every 5 minutes and when the panel opens, instead of the room sending `board` (the Worker has no database access; the spec allows 5-minute polling in Phase 0). The welcome `board` stays empty. Course codes are matched case-insensitively here ("dtip 122"); only the village's own tags decide what shows. Desker stores dates with no time zone, so due times are read as Bangkok time (UTC+7).

## Checkpoint 10: phone basics (done)
- **Tap to walk:** tap a tile and the avatar walks there in straight lines, sideways first and then up/down, stopping at the first blocked tile (`tapRoute` in `world.ts`; A* in Phase 1). A key press, or tapping while seated, takes over (seated: stands first).
- **Touch layout** (a coarse pointer, or `?touch=1` to test on a desktop): a bottom bar with Talk, Sit, Focus, Board and More (Members, Chat log), icon over label, 52 px tall. Prompts name the button ("Tap Sit") instead of the key. Panels are bottom sheets under 640 px wide (Board, Members, pickers, the timer prompt). The bubble box has a Send button and lifts above the keyboard through `visualViewport` (`--kb`). Safe-area insets pad the HUD.
- **Zoom:** desktop 3x, tablets 2x, phones about 15 tiles across (width / 240, in quarter steps, so 390 px = 1.75x). Pinch and double-tap zoom are blocked (viewport meta, `touch-action`, `gesturestart`).
- **Not verified on real devices:** iOS Safari and Android Chrome (the keyboard lift and non-integer zoom crispness especially), and the canvas is not DPR-aware, so very high-density phones may look soft. Checked in a 390 px iframe on desktop Chrome.

## Checkpoint 11: analytics, deep link, polish, load test, README (done)
- **Analytics** (`village_event`, never message text; `api/village/_events.js` keeps only the props in its allow-list): `village_opened` (device), `village_joined`, `desk_claimed`, `bubble_sent` (zone, length), `focus_started`, `focus_completed` (planned, actual, valid), `board_opened`, `session_minutes` (minutes present and focus minutes, sent when the tab hides or closes, by `sendBeacon`). The server records the ones about the database; the browser may only report `village_opened`, `bubble_sent`, `board_opened` and `session_minutes` (`POST /:slug/event`). Desker's own analytics stay off unless `ANALYTICS=on`; the village events are always on. A running timer counts toward focus minutes when it ends.
- **Gate report:** `node scripts/village-report.ts [days]` prints, per village per day, members, sessions, minutes present, focus minutes, bubbles, and whether 3+ members overlapped (each `session_minutes` event covers the minutes before it). Bangkok days.
- **Deep link:** "Study in the village" on desker.dev's Today page goes to `<village host>/go`, which opens the village you visited last (newest `last_seen_at`), or the picker.
- **Polish:** footstep dust when running, a gentler camera when seated, a hover tooltip over any avatar (name, and status or presence as far as sharing allows). Phaser was already lazy-loaded; the render loop stops with the tab (requestAnimationFrame does not run in a hidden tab).
- **Load test:** `scripts/loadtest.ts --clients 30 --minutes 3` against the local Worker: 30/30 joined, 0 dropped or corrected moves, 0 errors, ping p50 1 ms / p95 7 ms, about 136 messages/s in and 536/s out, Worker CPU 3% average (5% peak), 57 MB. This is the local `wrangler dev` runtime on one machine, not Cloudflare's network.
- **README:** `apps/village/README.md` (architecture, local dev, env vars, seeding, report, deploy steps, DNS). Nothing was deployed.

### Phase 0 status
All 12 checkpoints are built. What the owner still has to do: apply migrations 005 and 006 to production, deploy the Worker and the Vercel project, set the DNS and env vars (README), delete the stray production test account `village-test-b278e9@desker.test`, then run the demo script with friends and read `village-report.ts` for the gate (3 groups, 3+ sessions each in a week).
Known simplifications: tap-to-walk is straight lines; the Board is polled every 5 minutes and read-only; chat history lives in the room's SQLite, not Postgres; the room forgets positions on restart; no sounds beyond a blip and chime; the avatar is not yet customisable; real-device phone testing is outstanding.

## Phase 1, Checkpoint 1: create a village (done)
- `/new` (name + address + template, courses, rules), `POST /api/village` (limits 5 owned / 20 joined in `packages/shared/src/create.js`), picker cards (colour dots = seen in the last 10 min, studying now = open timers, next Board deadline). Deviation: the welcome line is a toast until a Kodama NPC exists.
## Phase 1, Checkpoint 2: invites, joining, roles (built, awaiting owner's test)
- Migration `007_village_invite.sql` (file only). `/i/:code` preview -> Join -> first-time setup (colour, sharing, deadlines). Invite panel (expiry, uses, guest links, copy, LINE, QR via `qrcode-generator`, revoke). The temporary join key is gone (`/join`, `join_key_hash`, `keyMatches`); `scripts/village-seed.ts` now prints a real invite and is dev only.
- Roles: one table in `packages/shared/src/permissions.js` (`can`, `canModerate`, `canSetRole`, `inviteVerdict`), used by the API, the room (claimDesk) and the screens; tested row by row.
- Manage members (owner/admin): role, kick (can rejoin), ban/unban, transfer by typing the village name. Leave (non-owner), close village (soft delete, 7-day undo from the picker; members see "This village was closed").
- Kick/ban/role change/close reach the room at once: the API calls the Worker's `POST /room/:vid/revoke` with a 60 s signed `role: 'revoke'` token (base URL from `VILLAGE_REALTIME_HTTP`, else `VITE_REALTIME_URL` with ws->http). Closing code 4004 = removed, 4005 = reconnect with a fresh token. Without it, changes still land when the 10-minute token ends.
- New dependency: `qrcode-generator` (apps/village), loaded only when a QR is shown.
## Phase 1, Checkpoint 3: Do Not Disturb, emotes, knock, member actions (done, tested)
- G = DND ("🎧 shh" beside the head): the room delivers nothing, holds @mentions, shows them as "While you were away" on exit. E = emote wheel (8, keys 1-8), shown 3 s; same reach as bubbles but also in the Library; none to DND. Knock: delivered / held while focusing / dropped in DND with a polite note to the knocker / 1 per target per 2 min (kept in room memory). Member actions (list or click an avatar): Locate, Walk to, Follow (pill, Esc), Wave, Knock. Rules in `packages/shared/src/social.ts`.
- Not yet: local time in the hover tooltip (needs the Settings opt-in, CP11); long-press sheet on phones (CP10).
## Phase 1, Checkpoint 4: click-to-walk, minimap, zone notes (done, tested)
- `packages/shared/src/pathfinding.ts`: A* (4 directions, tiny turn penalty so routes are straight, not staircases). `clickRoute`: a seat (free or taken) -> a tile beside it, then you face it so X sits; a wall -> nearest reachable tile. Mouse click and phone tap both use it; Shift at click time = run; faint footprints for 600 ms; Walk to / Follow use it too. `tapRoute` is no longer used by the scene.
- Minimap (M, or More on phones; hidden by default on phones): click to walk. Deviation: sits top-right and the Members panel moves below it. Zone note ("Library · quiet zone") at most once a minute per zone (`zoneNote.ts`).
## Phase 1, Checkpoint 5: questions (done, tested)
- Migration `009_village_qa.sql` (file only; `village_question`, `village_answer` with a `helpful` flag). Rules in `packages/shared/src/qa.js` (200/500 chars, word filter, 3 questions and 10 answers per minute, asker or admin resolves). The word filter moved from `wordfilter.ts` to `wordfilter.js` so the API can use it.
- Q (or the Ask button) opens the Ask box with a course chip (defaults to the running timer's course). Sending shows a "? ..." bubble by the usual reach (hint "..." when a little too far, nothing in Do Not Disturb). The Board has a Questions column (open first, newest first) and a thread view: answers, "This helped" (asker only), Mark resolved/Reopen.
- Notices: the API tells the room through `POST /room/:vid/notify` (60 s signed `role: 'notify'` token). The asker hears of an answer by state: Available -> toast, Focusing -> after Focus, DND -> "While you were away", offline -> push (CP8). Everyone else gets a silent `qupdate` so open panels refresh.
- Analytics: `question_asked`, `question_answered`, `question_resolved`.
