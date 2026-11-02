# Kodama Village, Phase 1b: Go live and close the gaps (about 1–2 weeks)

Phase 1 is built (14 checkpoints, branch `village`). It has passed unit tests, API/WebSocket tests and a 50-client load test, but it has **not** been proven with real people on real devices, and parts of it were never seen in a browser. Phase 1b gets it live, makes it trustworthy, and tells us whether the Phase 1 gate can be met. Phase 2 (`phase-2-make-it-yours.md`) starts only after this.

Read `docs/village/SPEC.md` (all Status sections for Phase 1, CP1–CP14) and `docs/village/prompts/phase-1-mvp.md` first. The spec is the source of truth. If this prompt conflicts with it, or the code conflicts with either, stop and ask.

## Ground rules (unchanged)
- I run production SQL in the Neon SQL editor (paste raw SQL, not file paths), deploys, and env vars. Ask before merging to `main`, before anything that writes to the production DB, and before rotating secrets.
- Never enter, read back or ask for passwords or keys. Never use `vercel dev`, `vercel link` or `vercel env pull`. Never touch the production DB from dev.
- New tables are prefixed `village_`. Never change existing Desker tables without asking.
- Run typecheck and tests before each commit. Commits end with the Co-Authored-By line. Do not touch the main checkout.
- I do not want to test by hand what you can test yourself. Tell me only what I must do.

## Gate this phase must make possible
**Most villages still have 3+ active members after 4 weeks** (Phase 1's gate), measured by `node scripts/village-report.ts --cohort`. 1b makes the product good enough to start that clock honestly.

## Not in this phase
Anything from Phase 2 (decorating, Leaves, wardrobe, templates, goal tree, LINE).

---

## Checkpoint 1: Sign-in and access (blocking)
1. Confirm, with me, that `COOKIE_DOMAIN=.desker.dev` and `VILLAGE_ORIGINS=https://village.desker.dev` are set on the Desker Vercel project, and `DESKER_ORIGINS` (optional) on the village project.
2. Verify end to end on production (read-only for you; I sign in): sign in on desker.dev, open village.desker.dev, no loop, no "Sign in on Desker first". Test with an old host-only cookie, a private window, and Safari.
3. Fix whatever remains. The stale-cookie cleanup and "share an existing session with the whole domain" are already in (`api/auth/[...all].js`); check they behave in production and add a regression test for any new finding.

**Done when:** a signed-in Desker user lands in the village in one click on Chrome, Safari and a phone.

## Checkpoint 2: Production readiness
- Give me, in order, the SQL for `012_village_safety.sql` and `013_village_indexes.sql` (if not applied), the Worker redeploy command, and the exact env var list with where each value comes from (VAPID keys reuse Desker's; `CRON_SECRET` is new).
- Smoke-check production read-only after each step: `/api/village/mine` returns 401 signed out, `/version.json` loads, the Worker answers `426` on a plain request, the cron route rejects a missing secret.
- Confirm the daily Vercel cron is registered and runs (`/api/village/cron`).

## Checkpoint 3: Move the throwaway tests into the repo
The API/WebSocket flow tests (create → invite → join → kick → rejoin → ban; Q&A; Board; group session; block, report, slow mode, mute, delete; export/summary) live in a scratch folder. Port them to `test/e2e/*.mjs`, runnable with one command against the local dev stack (`npm run test:e2e`), with a README for starting the stack. They must not touch the production DB. Include a permission test for **every row of the role matrix on both the API and the room**, and invite expiry / max uses / banned-gets-no-token.

## Checkpoint 4: Close the Phase 1 gaps
Build, in this order, each with tests where logic is involved:
1. `scripts/village-reports.ts`: Desker admins list all reports across villages (who counts as admin: reuse `api/_admin.js`).
2. Group Table start: begin a study session from a Group Table; participants get a shared badge colour.
3. Knock push for people who are offline or have the tab hidden (respects DND, quiet hours, caps).
4. "Show local time" opt-in (Privacy) and the local time in the hover tooltip.
5. Block parity: decide with me whether blocked people may still follow (leak risk); document the decision.
6. Thai coverage for the remaining panels (Board, Questions, Group, Invite, Manage, Members, Notifications). Add each new string to `docs/village/th-review.md` for my native review.
7. Rename the group events to match SPEC §13, or update the spec (ask me which).
8. Automatic Low effects from measured frame time, on top of the existing toggle.

## Checkpoint 5: See it in a browser
Drive the real UI with Chrome automation (desktop and a 390 px phone viewport, `?touch=1`) and fix what you find. Cover, with screenshots in the report:
- Create a village, invite, join (two accounts), first-time setup, tour.
- Board: add, dedupe, confirm, add to planner; Questions; announcements.
- Study together with at least three accounts; break tint and chimes; summary card.
- Settings: remap a key, accessibility switches, Thai; Block / Report / Remove / slow mode.
- Joystick and long-press (simulated pointer events); install hint on an iOS user agent.
- The Desker side: Today dots, Sunday line, Export JSON, the Village header button.
List anything you could not verify (real iOS/Android, real push) separately.

## Checkpoint 6: Real devices and real people ⏸ STOP, I RUN THIS
Give me a one-page checklist (the demo script from Phase 1, shortened) for me and 3–4 friends on real phones and laptops. It covers: touch and joystick, push on desktop Chrome / Android / iOS Home Screen, install to Home Screen, a 25/5 × 2 group session, DND and knock, block, quiet hours. I report back; you fix.

## Checkpoint 7: Start the clock
- Make sure every Phase 1 event fires on production data (check `village_event` after my test).
- Run `node scripts/village-report.ts --cohort` against production and explain each column in plain words.
- Write the weekly routine: when I should run the report, what "good" looks like (3+ active members in week 4 for most villages; chat-to-focus ratio low), and the signals that mean "fix feel, don't add features".
- Update the Status section of `docs/village/SPEC.md`.

---

## When you finish, report back with
1. What was fixed or built, checkpoint by checkpoint, with evidence (test output, screenshots).
2. What I still have to do, in order.
3. Known issues and risks that remain.
4. Whether anything in the Phase 2 prompt should change given what you saw (it assumes the gate has passed; propose the edits).
