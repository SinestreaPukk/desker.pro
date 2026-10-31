# Changes (fix, refocus & redesign pass)

Status: **Phases 1 to 8 done (decisions recorded: kodama is the companion, migrations as files only, retune Yuki).**

## Phase 1: reliable planner and calendar
- `src/schedule.js` (new, pure, tested in `test/schedule.test.mjs`): the only code that assigns planned times.
  No overlaps between tasks or with timed calendar events, free-time caps (today's own number wins today), deadlines (including a
  deadline's time of day), a 07:00 to 23:00 window, nothing in the past today, tasks with no duration get 1h (flagged `assumed`).
  A task that cannot meet its deadline gets the earliest slot after it and a plain sentence: "Can't fit X before its deadline: 2h short".
- Replan: the AI's plan is only a proposal, `planWeek` verifies it. If the AI is unreachable, Replan falls back to the rule-based plan.
  A task keeps its current slot when that is still valid.
- Chat agent: `applyPlanChecked` (`src/shared.jsx`) verifies every time the agent sets; what cannot fit is listed under its reply.
- Today flags existing double-bookings ("Two things are planned at the same time. Replan to fix it.").
- Calendar grid bug: `TimeGrid` set `--px: 44px` for the hour lines, which turned every 2px border inside the grid into a 44px border
  that covered the label and made blocks look the same height. Fixed with real hour-line elements. Hour labels and block text are 20px.
- Colours: one per kind (`CAL` in `src/ui.js`): task icy blue, for fun green, deadline the one red, event frost grey; same in Month, Week, Day and the key.
- Copy: your calendar link is read about once an hour while Desker is open ("Last synced: ..."); Google refreshes Desker's feed about once a day.

## Phase 2: trust and polish
- One date format, "Sat, Oct 31" (`fmtDate`, `fmtDay` with Today/Tomorrow/Yesterday), also in editable fields through `DateField`
  (the native `<input type=date>` stays on top, invisible, so the picker and keyboard work). Time inputs widened. Deadline row says "5h of work".
- Settings: developer copy removed; the API key is under Advanced, masked, with Reveal and Copy; Delete account sits in its own Danger zone.
- Kodama tips depend on state (no goals, goals without milestones, news) and the goal/milestone tips only appear on Goals.
- Desktop content is centred (1164px, Tasks stays 1400px).
- AI task generation (`api/deadline.js`, `api/_project.js`): verb-first, concrete, at most 1.5h each, "find out" task instead of guessing weak topics.

## Phase 3: a student planner
- Copy, defaults and meta tags: projects default to Exam (Exam, Assignment, Group project, Course, Personal), no investment examples, new `<title>`, description, Open Graph tags, manifest.
- Model in the UI: a deadline (exam, quiz, assignment) holds tasks; a project (course, group project) holds several deadlines. Said in the add box, the Projects page and the page banners. No data migration was needed: kinds are free text and the fields did not change.
- First run is one short screen: two taps (when you feel sharpest, whether tasks take longer than expected) then your first task or deadline.
  A first task gets a real slot (`src/onboarding.js`), so Today opens with a "Right now" card. A first deadline invites you to break it into tasks.
  Stored as `onboarding: { sharpest, slow, at }`. The old "who is Desker for" chips are gone.
- Goals leads with this term's goals; mid-term, long-term and vision are behind "Expand your pyramid" (open by default when you already have such goals).
- The XP / quests / badges panel is removed from Today (the data is untouched).
- "Right now": "Do this next", the scene is 64px shorter on desktop so Start is on the first screen at 1470x769.
- `desker.tour.seen.business/personal`: no such flag exists in this repo (source or `dist/`), so nothing was removed.

## Phase 6: signed-out experience
- `/` for signed-out visitors is a landing page (`src/Landing.jsx`): "The planner that learns how you study", the kodama in the winter scene, three features with drawn examples (marked "Example"), a supporting row, footer with Privacy, Terms and (if `VITE_CONTACT_EMAIL` is set) Contact. Signed-in users still go to `/today`.
  The copy promises the rhythm page and the kodama's rituals (Phases 4 and 5); the example numbers ("38% off, now 12%") are illustrative.
- `/privacy` and `/terms` (`src/Legal.jsx`) are placeholders with TODOs for you to write. `vercel.json` rewrites them.
- Sign-up is email and password. Name and username are derived from the email (`deriveAccount`, a taken username gets a number); sign-in by email or username is unchanged; the confirm-password field is gone on sign-up (Show/Hide stays), but kept on password reset.
- Google/GitHub buttons already existed behind `GOOGLE_CLIENT_ID/SECRET` (and GitHub's); they now sit above the form as "Continue with Google" and stay hidden when the variables are missing.
- **Not done, on purpose: letting people in before they confirm their email.** Verification is only required when a mail provider is configured. Skipping it would let anyone register someone else's address and later block or hijack that person's sign-up. If you still want it, the safe version is: verify before the first password reset or before any email is sent, which needs a server change in `api/_auth.js` (`requireEmailVerification`).
- SEO: `index.html` carries the landing copy (visually hidden, replaced when the app loads), canonical link, Open Graph and Twitter tags, and `public/og.png` (1200x630, made from the winter scene). Real pre-rendering would need an SSR build step; not added.

## Phase 4: the rhythm engine
- **Model** (`src/rhythm.js`, pure, 19 tests in `test/rhythm.test.mjs`): each kind of work (Reading, Problem set, Writing, Revision, Lab report, Group work, Admin, Other) gets a
  "takes you Nx your estimate" number. It starts from a prior (1.3, or 1.0 / 1.3 / 1.6 from the sign-up answer) and moves toward the data with weight n / (n + 5); a type with
  little data leans on the overall number; one wild sample is squashed to 4x; a forgotten timer (over 10 h) is ignored. Energy is an hour-by-weekday curve: the sign-up "sharpest"
  answer is the prior, check-ins (and, weakly, the hours you finish things) take over; it only drives planning after 8 check-ins. Also typical focus length and start lag (3+ sessions each).
- **Capture**: the focus timer records each sitting (start, end, focused minutes, pauses, finished or abandoned, start lag); ticking a task off without the timer asks "How long did that
  take?" (estimate preselected, 15 min / 30 min / 1 h / 2 h / Other, skippable); tasks timed with the timer record automatically. Today asks about energy at most twice a day (8:00-21:00, not
  within 3 h of a tap); the energy buttons still work any time. Reschedules and Right now accept/skip are recorded as signals. Task type comes from the title (offline rules), or from the AI
  when it generates the task (`type` in `api/deadline.js` and `api/_project.js`), and can be corrected on the Rhythm page.
- **Use**: the scheduler reserves learned time (`scale` per task, `pad` for a habit of starting late) and puts deep work in the best-energy slot of its day (never breaking a deadline, free
  time or calendar event). The reserved length is stored on the task (`block`, `blockOf`; extra fields, no schema change) and the Calendar draws it. Replan, the chat agent and first-run planning all go through it.
  Today shows a reality check ("You planned 5 h. At your usual pace that is about 7 h"), predicted energy for Right now, and the timer starts at your typical focus length. The agent gets a numbers-only summary.
- **Your rhythm** page (tab `/rhythm`, replaces the Insights card): summary and "what Desker learned this week" (Sundays: the report), per-type multipliers, weekly accuracy (your estimates vs
  Desker's plan), energy heatmap, and controls: correct a type, forget a timing, ignore a date range, switch learning off, download JSON, delete everything learned. On phones it is reached from Today's card
  (six labels do not fit the bottom bar).
- **Storage and migration**: lives in the account document (`rhythm`, whitelisted in `SETTINGS`; `energyLog` as before), capped at 300 outcomes / 150 sessions / 150 signals, older outcomes folded into small
  per-type sums so nothing learned is lost. `db/migrations/001_rhythm.sql` creates `focus_sessions`, `energy_logs`, `task_outcomes`, `rhythm_profile`. **It is not applied and nothing reads it yet.**
  Run it on a branch database when you are ready; switching the app to the tables is a follow-up.
- **Not done**: splitting a long task into several blocks (one task = one slot in the data model; the timer length and break-friendly blocks are the substitute, say if you want real splitting);
  a separate AI call to classify old tasks (no new function: the Hobby plan caps at 12). The Rhythm page now has its own stripe (`art/authoring/gen_stripes.py`, `rhythm()`).

## Phase 5: the kodama companion
- **One character.** The AI agent is the kodama: "Talk to {name}" opens the chat, which now speaks in its voice (`src/persona.js` feeds the system prompt in `api/chat.js`; edit that file to retune it). You name it on the first-run screen
  (optional) or from Today ("{name}, sapling" opens its name, growth and window view). Default name "Kodama". The Deskie shimaenaga stays the logo and favicon only.
- **Home on Today**: the scene is now its window view with the kodama in it and a line from it next to the greeting. The lines (`lineFor` in `src/kodama.js`) know the time, your plan, the rhythm model (predicted energy, an over-full day) and your absence
  ("Welcome back. No rush"). It never mentions missed days; after 23:00 it suggests rest. A test scans every line for pressure words.
- **States**: idle, focus (while the timer runs), sleepy (night), happy / lucky (milestones, a task just finished), cozy (evening wrap-up done), calm (a heavy day). Only idle/blink, happy and lucky are drawn; focus, sleepy, cozy and calm reuse those frames at a different pace.
- **Rituals** (both optional, skippable for the day, never counted against you): a *morning plan* (today's plan, an energy tap, "Looks good") and an *evening wrap-up* (mark what got done or move it to tomorrow, how long things took, how the day felt). They write timings and energy into the rhythm data.
- **Growth replaces XP, levels, quests and badges.** Points come from honest habits: a real timing (3), a ritual (4), an energy tap (1, max 2 a day), a finished task (1, max 5 a day), plus the old XP total once (`xp / 8`, stored as `kodama.legacy` the first time the app loads; `data.xp` itself is untouched).
  Stages: Seedling, Sprout, Sapling, Young tree, Elder. Growth never goes down. Sprout unlocks choosing the time of day for the window view, Sapling the season (these used to be levels 2 and 3). Stage up is announced once with a quiet toast.
  The streak still exists with its one-rest-day-a-week forgiveness but is no longer used in any kodama message.
- **Notifications (web push)**: toggle in Settings (only when the VAPID keys are set), quiet hours you can change, at most two a day (08:00 and 19:00 local), nothing when you have been away 5+ days. Needs `web-push` (new dependency),
  `public/sw.js`, and an hourly caller for `/api/state?push=1` (all 12 Hobby functions are used, so it lives in `state.js`). **Not tested end to end: it needs real keys and a real browser subscription.** The rules (`src/pushPlan.js`) and the sender's logic are unit-tested or short enough to read.
- **New env vars** (all optional, documented in `.env.example` and the README): `VITE_VAPID_PUBLIC_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.
- **Poses to draw** (the kodama sheet is 44x44 frames: idle a/b, happy a/b, lucky a/b): focusing (eyes down, a tiny book or lamp), sleepy (nodding, eyes closed, optional "z"), cozy (a blanket or a mug), calm-concerned (soft eyes, leaf drooping slightly), plus two accessories for Young tree (leaf crown) and Elder (lantern).
- **Clash with the brief, resolved the safe way**: "reuse the user's kodama pixels" and "state sprites for six states" cannot both be met with the six frames that exist, so four states borrow frames; nothing was redrawn.

## Phase 7: calm, snowy, one kit
- **Palette retuned** (still Yuki, same names): slightly bluer snow; **icy blue** is the accent (`kori-3`, links, active tab, primary buttons, progress bars, focus colour); **lantern amber** (`ando-0/1/2`, new) is used sparingly for the one thing to look at
  (the "Right now", Morning plan and Evening wrap-up tabs); the red (`beni`) is muted and kept for danger and the done stamp. The scene's `daidai` oranges are pulled toward amber. `yuki-3` was darkened so field and panel outlines reach 3:1.
- **Dark theme** (Settings, Appearance: match device / light / dark; stored on this device; no flash on load): the same colour names with night values (`art/palette/yuki16-dark.json`). The kit sprites are rebuilt in dark into `public/pixel/dark/`
  by `npm run pixel:build`, and CSS picks them through `--k-*` variables, so there is no filter trick. Characters (Deskie, kodama) and the scene art are the same in both themes.
- **One source of colour**: components use tokens only (the last hard-coded hex, in `src/review.js`, now uses `var(--color-*)`). `test/palette.test.mjs` fails if the sprite palette, the dark palette, the scene palette and the CSS tokens disagree, if a component hard-codes a hex,
  and checks WCAG AA for the pairs the UI uses in both themes (body, secondary, captions, links, primary button, lantern tab, danger, positive text; 3:1 for outlines).
- **Winter by default**: the window view is winter unless you choose a season (Sapling unlocks the choice). The calendar-month seasons are gone; weather no longer switches it.
- Sprites recoloured from their text sources (`btn-primary` now uses `kori-3`; new `tab-ando`); page stripes regenerated with the new palette. `npm run pixel:lint` passes.
- Focus rings were already a 2px ink outline with offset on every control (works on both themes); motion was already off under `prefers-reduced-motion` (kodama states included).
- Fixed: the Calendar toolbar clipped its "Today" button on phones.
- **Decided not to change: the body font.** VT323 at 24px (20px small) is already well above 14px and is the pixel identity; swapping paragraphs to a system font would reflow every screen and mix two voices. Say if you want it anyway: it is one variable (`--font-sans`) plus `p`/`li` rules.
- **Art still needed**: a dusk sky that is not peach (the landing hero uses winter dusk; `hada` in `art/scene_build.py` roles), and the kodama poses listed under Phase 5.

## Phase 8: measure it
- **Events** (`src/analytics.js`): an allow-list of 18 event names (`signed_up` ... `notification_opened`, including `notification_sent`, which the server logs). `sanitize()` keeps only numbers, booleans and a fixed set of short words from a whitelist of property names, so a task title cannot get in even by mistake (tested). Sources are `manual`, `ai`, `import` for `task_created`; durations are `timer` or `chip`.
  The client batches and sends to `/api/state?events=1` (no new function). **Off unless `ANALYTICS=on` (server) and `VITE_ANALYTICS=on` (client)**, so local development records nothing. Table in `db/migrations/002_events.sql` (not applied; without it the endpoint swallows the error).
- **Dashboard** (`/dsb`, "Beta health", `api/_beta.js`): sign-ups and active people per week; D1 / D7 / W4 retention and tasks done per active user; *moat health*: share of finished tasks with a real duration, energy check-ins per active user, median estimate error vs Desker's plan error by weeks since sign-up;
  *companion health*: wrap-ups and morning plans per active day, notification open rate, W4 retention for people with 3+ rituals in their first two weeks against everyone else. Each query is separate, so one failure shows on its own. Except the notification rate, everything is computed from existing tables and the account document, so it works before the events table exists.
  The SQL was run against an in-memory Postgres (PGlite) with a tiny matching schema, not against your Neon database.
- **Approximations, stated on the page**: wrap-up and morning-plan rates are per *active day* (the brief's "completion rate" and "open rate" would need an events table with a denominator for prompts shown); retention uses UTC days; the notification rate counts events from the last 28 days.
- **Privacy placeholder** now describes the event log (tied to the account, no free text, deleted with the account, off by default). You still have to write the real policy.

## TODO for you (collected)
- **Apply migrations on a branch database first**: `db/migrations/001_rhythm.sql` (nothing reads it yet) and `002_events.sql` (needed for analytics and the notification rate). I did not run either against the Neon database in `.env.local`.
- **Env vars to set when you want the features**: `ANALYTICS=on`, `VITE_ANALYTICS=on`; for notifications `VITE_VAPID_PUBLIC_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` and an hourly caller of `/api/state?push=1`; `VITE_CONTACT_EMAIL` for the landing footer Contact link. Nothing was invented; each is blank in `.env.example`.
- **Legal text**: replace the TODO placeholders in `src/Legal.jsx` (privacy, terms).
- **OAuth**: sign-in with Google/Apple is still not set up (needs your client IDs).
- **Art to commission**: kodama poses (focusing, sleepy, cozy, calm) and Young tree / Elder accessories, a dusk sky that is not peach.
- **Test push notifications end to end** with real keys and a real browser; it is not tested.

## Tests
`npm test` (106 pass), `sh scripts/pixel-lint.sh` (0 errors). No typecheck script exists in the project.

## Not done yet, and why: see the questions at the end of the session.
