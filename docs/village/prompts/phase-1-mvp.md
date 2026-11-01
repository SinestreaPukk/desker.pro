# Kodama Village, Phase 1: MVP (about 4–6 weeks)

Phase 0 is done and passed its gate: friend groups do study together in the village. Phase 1 turns the prototype into a product any student can use without me:

- They create their own village, invite friends, and run it themselves.
- It's safe.
- It works well on phones.
- The Board and group study sessions make it the place a friend group studies every day.

Read `docs/village/SPEC.md` in full, including its **Status** section, before you start. The spec is the source of truth. If this prompt conflicts with it, or the Phase 0 code conflicts with either, stop and ask.

## Gate this phase must make possible
**Most villages still have 3+ active members after 4 weeks.** Build the cohort report in Checkpoint 14 so I can measure it.

## Not in this phase
Build mode / decorating, Leaves spending, kodama accessories, extra map templates, seasons, the village focus goal tree, LINE notifications, public villages, payments, voice/video, private messages.

---

## Checkpoint 0: Review and plan (no code)

1. Read the Phase 0 code and the spec's Status section. List any Phase 0 shortcuts that must be fixed before building on them (e.g. Board polling, the temporary join key, colour stored in a jsonb).
2. Propose migrations for the Phase 1 tables (SPEC §9):
   - `village_invite`
   - `village_board_item`
   - `village_board_confirm`
   - `village_question`
   - `village_answer`
   - `village_group_session`
   - `village_group_participant`
   - `village_block`
   - `village_report`
   - Push subscription storage (reuse Desker's if it exists)
3. Propose how auto-shared Board items will update without polling (DB trigger + notify, an event from the Desker API when deadlines change, or a queue), given our stack.
4. Propose the i18n approach (English + Thai) for the village UI. Use the library desker.dev already uses, if any.
5. **Decisions to confirm:** list anything you need from me, e.g.:
   - VAPID keys
   - The Thai word-filter list
   - Who counts as a Desker admin for reports
   - Quiet-hours default

**Stop and wait for my approval.**

---

## Checkpoint 1: Create a village

- New route `/new`: a 3-step creation flow in the React shell, styled like desker.dev's pixel UI.
  1. **Name** (3–40 chars) + auto slug (editable, unique, a–z, 0–9, hyphens) + template picker. Only "Snowy Campus" is enabled; two locked cards show "Coming soon" for Tea House and Night Library.
  2. **Courses:** a course code chip input with suggestions from the creator's Desker courses. Used for the Board.
  3. **Rules:**
     - Who can invite: owner+admins / everyone
     - Library auto-focus: on/off
     - Status sharing default for new members: basic/full
- On create:
  - Insert `village` + owner membership.
  - Write a `village_opened` event.
  - Drop the owner at the Board with a one-time Kodama NPC bubble: "Welcome to your village! Invite friends from the ⋯ menu."
- The village picker (`/`) shows cards with:
  - Village name and a tiny live preview of who's online (colour dots)
  - "3 studying now"
  - The next Board deadline
- Limit: a user can own up to 5 villages and be a member of up to 20 (constants).
- Remove the seed script's temporary join key from use (keep the script for dev only).

**Done when:** a brand-new user can create a village from the picker in under a minute and is standing in it.

---

## Checkpoint 2: Invites, joining and roles ⏸ STOP AND LET ME TEST

- **Invite panel** (⋯ menu → Invite):
  - Create an invite link: expiry 24 h / 7 days / never; max uses: unlimited / 1 / 10 / 50.
  - Copy button.
  - **Share to LINE** button, using LINE's share URL scheme with a short message plus the link.
  - QR code for in-person sharing.
  - A list of active invites with uses, and Revoke.
- **Join flow** `/i/:code`:
  - Preview card (village name, owner, member count, online count) → **Join**.
  - Sign in if needed, then return here.
  - First-time setup: colour pick (30 s), status-sharing choice explained in one line, "Share my deadlines?" toggle (off by default).
  - Spawn with a sparkle; Kodama NPC says "This is the Board. Your desk is waiting in the Library."
  - Refuse cleanly when: expired, revoked, max uses reached, village full (`VILLAGE_MAX_MEMBERS`), or banned.
- **Roles.** Enforce SPEC §12 and this matrix **on the API and in the room**:

| Can they… | Owner | Admin | Member | Guest |
|---|---|---|---|---|
| Walk, sit, bubble, ask, emote | ✓ | ✓ | ✓ | ✓ |
| Claim a desk | ✓ | ✓ | ✓ | – |
| Add due dates and exams | ✓ | ✓ | ✓ | – |
| Edit/delete any Board item | ✓ | ✓ | own only | – |
| Post announcements | ✓ | ✓ | – | – |
| Invite | ✓ | ✓ | if allowed | – |
| Start a group session | ✓ | ✓ | ✓ | – |
| Remove a bubble from the log, kick, ban | ✓ | ✓ | – | – |
| Change village settings | ✓ | ✓ (not delete/transfer) | – | – |
| Promote/demote admins, transfer, delete village | ✓ | – | – | – |

- **Members panel** (⋯ menu → Members; owner/admin only):
  - Change role
  - Kick (can rejoin with an invite)
  - Ban (can't rejoin; `banned_at` set)
  - Transfer ownership (confirm by typing the village name)
- Leave village (any non-owner). Delete village (owner): soft delete with a 7-day undo; members see "This village was closed".

**Tests:**
- A permission test for every row of the matrix, on both the API and the room.
- Invite expiry and max uses.
- A banned user can't get a token.

**Stop here** and tell me how to test the full create → invite → join → kick → rejoin → ban flow locally.

---

## Checkpoint 3: Presence, emotes, knock and member actions

- **Do Not Disturb (G):**
  - Headphones + "shh" sign sprite overlay.
  - Bubbles, knocks and mentions are not delivered at all while in DND.
  - Mentions are listed in a "While you were away" card when DND ends; nothing else is replayed.
- **Emotes (E):**
  - A radial wheel of 8 pixel emotes (wave, cheer, coffee, sleepy, confused, good luck, thumbs up, shh). Keys 1–8 pick one; mouse or touch works too.
  - Shows for 3 s above the kodama with a little hop.
  - Delivered with the same visibility rules as bubbles, but always visible in the Library (they are silent).
- **Knock:**
  - From the member list or by clicking a kodama → Knock.
  - The target gets a soft knock sound and a toast: "Ploy knocked: chat when you're free?" with buttons **Walk over** (pathfinds to the knocker) and **Later**.
  - Queued while the target is Focusing; dropped while in DND, and the knocker sees "Ploy is in Do Not Disturb".
  - Rate limit: 1 per target per 2 min.
- **Member actions** (click a name in the list or click a kodama):
  - **Locate**: camera pans there for 2 s
  - **Walk to**: A* to the nearest free tile beside them
  - **Follow**: keep walking to them as they move, until you press any movement key; a small "Following Ploy · Esc to stop" pill
  - **Wave**: a wave emote aimed at them
  - **Knock**
- Hovering over a kodama shows a tooltip: name, presence, status (per sharing setting), local time if they've opted in.

**Done when:** I can follow a friend across the map, knock while they're focusing and have it arrive when their timer ends, and nothing reaches me in DND.

---

## Checkpoint 4: Click-to-walk, pathfinding and minimap

- A* on the collision grid (4-directional), in `packages/shared/pathfinding.ts`, unit-tested.
  - Click or tap a tile → walk the path at walk speed (Shift held at click time = run).
  - Clicking an occupied sit spot walks to the nearest free tile next to it.
  - Clicking an unwalkable tile walks to the nearest reachable tile.
  - The route preview shows faint footprints for 600 ms.
- Phone tap-to-walk switches from Phase 0's straight-line walking to A*.
- **Minimap (M):**
  - A small top-right overview of the zones, with dots for online members (your colour highlighted, friends in their colours).
  - Click the minimap to walk there.
  - Hidden by default on phones; toggle from the action bar.
- Zone name toast when entering a zone ("Library · quiet zone"), at most once per minute per zone.

**Done when:** clicking anywhere on the map gets me there by a sensible path in a fraction of a second, on both desktop and phone.

---

## Checkpoint 5: Ask questions (Q)

- **Q opens the Ask box:** text up to 200 chars + optional course chip (defaults to the course of your current status).
  - Sending shows a bubble with a "?" icon (same visibility rules) **and** creates a `village_question`.
- **The Board's Questions column:**
  - Open questions first, newest first.
  - Each shows text, course, asker, age and answer count.
- **Question thread view:**
  - Answers (up to 500 chars)
  - "This helped" on an answer
  - The asker (or an admin) can mark it resolved
- **Notifications:** when someone answers, the asker is told at the right moment:
  - Available → toast immediately
  - Focusing → queued until focus ends
  - DND → listed in "While you were away"
  - Offline → push notification (Checkpoint 8)
- Word filter and rate limits (SPEC §12) apply to questions and answers.

**Done when:** a question asked mid-focus is answered by a friend on break, and the asker sees it the moment their timer ends.

---

## Checkpoint 6: The full Board

- **Add item:** a **+** button in each column → modal with kind (Due / Exam), course chip (from `village.course_tags`, or add a new tag if you're an admin), title, date, optional time.
  - Normalise titles (lowercase, trim, collapse spaces, strip punctuation; Thai-safe) into `title_norm`.
- **Dedupe:** on add, if an item exists with the same course + `title_norm` + date within ±1 day, show "Looks like this is already on the Board" with **That's it, I have it too** (confirm) or **No, add mine**.
- **"I have this too":** confirm/unconfirm. Avatars of confirmers show on the item (up to 5, then "+3").
- **Add to my planner:**
  - Creates the deadline in the user's Desker account through Desker's own create-deadline code path (title, course, due date, kind).
  - Then shows "Added. Desker will plan the work leading up to it."
  - Marks the item "In your planner" for that user. Never adds a duplicate if one already exists in their planner.
- **Auto-shared items:**
  - Members with `share_deadlines = true` have their Desker deadlines for tagged courses appear automatically (`source = 'auto'`) and merge with manual ones.
  - They update without polling (the approach approved in Checkpoint 0).
  - If the member turns sharing off, their auto items disappear (confirms on merged items stay).
- **Announcements column:** owner/admin posts with title + optional body (500 chars) + optional pin. Pinned first.
- **Edit/delete:** per the role matrix. Deletes are soft. Past items disappear 24 h after their date.
- **In-world Board sprite:**
  - Shows a red pin if anything is due in 24 h
  - Shows a "?" pin if there are unanswered questions
  - Pulses gently when something new is added while you're in the village
- **Board panel layout:**
  - Desktop: 4 columns
  - Phone: tabs (Due · Exams · Questions · News)
  - Filter chips by course

**Tests:**
- Dedupe rules
- Title normalisation (English and Thai)
- Add-to-planner doesn't duplicate
- Sharing on/off

**Done when:** a member adds "Static quiz" for DTIP 122, a second member tries to add the same thing and gets merged, and both can add it to their Desker planner with one tap.

---

## Checkpoint 7: Study together (group sessions) ⏸ STOP AND LET ME TEST

- **Start a session:** from the ⋯ menu, at a Group Table, or in the HUD → focus minutes (25/50/custom 10–120), break minutes (5/10/custom), rounds (1–6).
  - The room creates a `village_group_session` and announces it: a soft bell, plus a banner "Mai started a study session · 50/10 × 3 · Join (J)".
- **Join (J or the button):**
  - You pick your task (same picker as Phase 0 F).
  - A Desker focus session starts for **you**, linked via `group_session_id`.
  - You're added to `village_group_participant`.
  - Joining mid-round is allowed; your Desker session starts when you join.
- **One timer, synced by the server** (`phaseEndsAt`):
  - Everyone sees the same countdown in the HUD and as rings above participants.
  - Participants get a small shared badge colour.
- **Break:**
  - A soft chime; participants' Desker sessions pause or end per Desker's model (decide in Checkpoint 0).
  - The Lounge lights get warmer, and a banner says "Break · 10 min · the Lounge is open".
  - Participants' presence becomes Available, so bubbles flow.
- **Break ending:**
  - A 60 s warning: "Back to desks in 1 min".
  - At 0, a gentle chime; each participant gets a prompt "Walk back to your desk? (X)" that pathfinds them there.
  - The next focus round starts for everyone.
- **End:** after the last round, or when the starter ends it (or everyone leaves), show a **summary card**: participants' kodamas, total time together ("4 of you · 2h 10m"), and each person's task (respecting status sharing). Save it.
- The session survives a room restart: persist state in the DB, and on restart rebuild it from `started_at` + phase durations.
- Only one group session per village at a time. A second "Start" offers to join the running one.

**Tests:**
- Phase timing maths across rounds
- Restart recovery
- Join mid-round
- Every participant gets exactly one Desker session per focus round, or per session (match Desker's model)

**Stop here** and tell me how to run a 3-browser group session test.

---

## Checkpoint 8: Notifications (web push)

- Use the village app's own service worker (copy the push-only pattern from desker.dev's `sw.js`: push handling only, no caching).
- Ask for permission **at a good moment**, never on first load. The best moment is after the user's first completed focus session or first question: "Want a nudge when friends answer or start a session?"
- **Notification types**, each with its own toggle in settings:

| Type | When | Rules |
|---|---|---|
| Question answered | Someone answers your question | Immediate if offline; queued if focusing |
| Knock | Someone knocks | Only if offline or the tab is hidden; never in DND |
| Group session started | A session starts in a village you're in | At most 2 per day per village |
| Village is busy | 3+ friends are studying now in your village | At most 1 per day total, only if you haven't opened the village today |
| Deadline tomorrow | A Board item you confirmed is due in 24 h | Once per item |

- **Quiet hours** 23:00–08:00 local by default (editable). Nothing is sent in quiet hours.
- Tapping a notification opens the right place: the question thread, the village, or the Board item.
- Clicking or tapping inside the app counts as seen, so nothing is sent twice.

**Done when:** each type arrives correctly on desktop Chrome and on iOS (Home Screen web app) and Android, and none arrive in quiet hours or DND.

---

## Checkpoint 9: Safety and moderation

- **Block:**
  - From a kodama or the member list → Block.
  - The blocked person's kodama, bubbles, emotes, questions and answers disappear for the blocker. The blocked person isn't told.
  - Blocked users can't knock or follow you. Unblock from Settings → Blocked.
- **Report:**
  - Reasons: harassment / spam / inappropriate content / other + an optional note.
  - Stores context: the last 10 chat log lines in that zone, and the reported text if it's a bubble, question or answer.
  - Owner/admins see reports for their village in the Members panel. Desker admins see all reports via `scripts/village-reports.ts`.
- **Owner/admin tools:**
  - Remove a bubble from the chat log (it also disappears for others' logs)
  - Delete a question, answer or Board item
  - Kick
  - Ban
  - Slow mode (1 bubble per 30 s for everyone; for exam season or problems)
- **Word filter:**
  - Extend the list (Thai + English) from a config file.
  - Catch simple evasion (repeated letters, spaces between letters, common leetspeak).
  - Never block or flag course names.
- **Complete the rate limits from SPEC §12.** Repeated violations → automatic 10-minute mute with a gentle message.
- Every moderation action is written to an audit log (reuse `village_event` with a `mod_` prefix).

**Tests:**
- Block filtering in every message path (bubble, emote, ask, answer, knock, follow)
- Slow mode
- Filter evasion cases

---

## Checkpoint 10: Phones, fully

- Virtual joystick (bottom-left, appears where the thumb lands, 8 px dead zone, snaps to 4 directions) alongside tap-to-walk.
- Action bar: **Talk**, **Ask**, **Sit/Stand**, **Focus**, **Emote**, **Board**, and **⋯** (members, minimap, settings).
- Long-press a kodama → the member actions sheet.
- **Make the village app installable:**
  - Its own `manifest.webmanifest`: name "Kodama Village", start_url `/`, standalone, icons
  - An "Add to Home Screen" prompt on iOS, shown after the second visit, with simple illustrated steps
- Performance: on a mid-range phone, keep 50+ fps with 20 kodamas. Reduce particles on low-end devices (check `hardwareConcurrency` and frame time), and offer a "Low effects" toggle.

**Done when:** a friend can use every Phase 1 feature on a phone without a keyboard, and the app opens from the home screen like an app.

---

## Checkpoint 11: Onboarding, settings, language and accessibility

- **First-visit tour** led by the Kodama NPC, 3 short steps with highlights:
  1. "Walk with WASD (or tap)."
  2. "Your desk is in the Library. Press X to sit."
  3. "Press F to start studying. Friends will see you focusing."

  Skippable; it never shows again once done or skipped.
- **Settings panel sections:**
  - **Controls:** remap keys, with a conflict check
  - **Sound:** master, effects, ambience
  - **Notifications**
  - **Privacy:** status sharing, share deadlines, show local time
  - **Blocked**
  - **Accessibility:**
    - Reduced motion (no bob, no particles, instant camera)
    - Larger bubbles text
    - High-contrast name tags
    - Colour-blind safe urgency colours (add icons, not just colour)
  - **Language:** English / ไทย
- **i18n:**
  - Every UI string goes through the approved i18n setup.
  - Provide a Thai translation and mark strings that need a native review in a list for me.
  - Bubbles and Board text are user content and are not translated.
- Keyboard-only navigation works for all panels. Screen readers can use the panels (the canvas itself can be `aria-hidden`, but the member list and Board must be accessible).

---

## Checkpoint 12: Connecting to Desker

- **desker.dev Today page:**
  - The "Study in the village" button shows "3 friends studying now" with tiny colour dots when that's true.
- **desker.dev weekly report:**
  - Add "Studied with friends: Xh in [village]" when there is data.
- **Privacy:**
  - Include all village data for the user in Desker's export (memberships, desk, Board items they added, questions/answers, focus links).
  - On account deletion, delete or anonymise it (questions/answers become "Former member").
  - Add a "Kodama Village" section to the privacy page draft (send me the text to review).
- Make sure the valid-timing rules apply to group-session focus rounds too.

---

## Checkpoint 13: Reliability and scale

- Load test: `scripts/loadtest.ts --clients 50 --minutes 10` with a realistic mix (60% sitting focused, 30% walking, 10% chatting; one group session running).
  - Report server CPU/memory, message rates, p95 delivery latency and dropped messages.
  - Target: p95 under 150 ms in the same region, no drops.
- Room restarts: positions may reset to desks/spawn, but group sessions, desks, Board and queued notifications must survive.
- Error monitoring: use desker.dev's tool if it has one (e.g. Sentry); otherwise propose one. Tag errors with village id and client version.
- A client version check: when a newer version is deployed, connected clients see "A new version is ready, refresh?" instead of breaking.
- Database: check indexes from SPEC §9 exist. Purge jobs:
  - Chat log: 24 h
  - Expired invites: 30 days
  - Resolved reports: 180 days

---

## Checkpoint 14: Analytics and the gate report

- Fire every Phase 1 event in SPEC §13.
- `scripts/village-report.ts --cohort` prints, for villages created in each week:
  - Size at day 7 / 14 / 28
  - Weekly active members (3+ minutes present) for weeks 1–4
  - % of villages with 3+ weekly active members in week 4 (**the gate**)
  - Minutes studied together per active student per week (**the north-star**)
  - Invites created → accepted conversion
  - Board items added to planners
  - Group sessions per village per week
  - Chat-to-focus ratio (bubbles per focus hour), to warn if it's turning into a hangout
- Update the Status section of `docs/village/SPEC.md`.

---

## Demo script (I'll run this at the end)
1. A brand-new student creates a village on their phone and shares the invite to LINE.
2. Four friends join from the link: two on phones, two on laptops.
3. Someone adds tomorrow's quiz to the Board; another merges into it; everyone adds it to their planner.
4. One person starts a 25/5 × 2 group session; everyone joins with a real Desker task.
5. During focus, someone asks a question with Q. A friend answers during the break. The asker sees it when the round ends.
6. Someone sets DND; a knock to them is refused politely.
7. Block test: one person blocks another and stops seeing them.
8. Close everything. Next morning, check push notifications behaved (no quiet-hours pings) and that every focus round shows in desker.dev's Rhythm.

## When you finish, report back with
1. What was built, checkpoint by checkpoint, and anything simplified.
2. How to run and deploy it, and any new env vars or services.
3. Known issues and risks.
4. The Thai strings that need native review.
5. Your suggestions for Phase 2, based on what you saw.
