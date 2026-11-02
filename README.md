# Desker

A low-friction to-do list and calendar that ranks your tasks and projects, so you know what to do next.

    npm install
    npx vercel dev   # runs the app and /api locally (load .env.local first: set -a; . ./.env.local; set +a)

Or, with no keys or database to set up:

    npm run dev:local   # http://localhost:3000

`dev/` serves the same `api/` handlers, but AI calls go through your logged-in `claude` CLI (they use your Claude plan) and the database is PGlite in `.data/` (delete it to start clean). The `/dsb` password is `dev`. Testing only: it listens on localhost and is not used by Vercel. AI answers can differ a little from production, as the CLI ignores `max_tokens` and sends earlier chat turns as text.

Look: white ground, tonal pale-blue panels (`#f3f6fc`), Instrument Serif for big titles and Instrument Sans for everything else, ink `#14213d`, calm pastel blue `#b4caf0` for primary actions and active states, deep `#35599a` for links. Shadows only on floating things (menus). Colours and radii live in the `@theme` block of `src/index.css`; shared classes in `src/ui.js`; icons in `src/icons.jsx`. See `DESIGN.md`, and `PRODUCT.md` for the product rules.

Pages: `/now`, `/calendar`, `/goals`. Every other path, such as the old `/today` and `/tasks`, lands on Now. `vercel.json` rewrites them to `index.html`.

- **Now:** Add, a top pick with a short reason, ranked alternatives that can each be started, "Also due today", Coming up, and the matrix behind "View matrix". Tapping a row opens its side sheet.
- **Calendar:** classes and meetings, imported or added by tapping a time slot, plus anything with a due date, like a reminder, with a Day, Week and Month switch. Sessions stay off it, and nothing is sent out.
- **Goals:** the vision above a ranked list of up to 5 goals, with projects under their goal, "done this week", a Not linked list and a Finished list. The goal finder (`src/finder/`) opens on a first visit and uses no AI.

On phones, the same three pages sit in a bottom tab bar, and inputs are 16px so iOS doesn't zoom.

The brain is pure and tested: `src/rank.js` (the live order, with no AI), `src/sessions.js` (progress against time, and the session rows), `src/goals.js`, `src/events.js`, `src/comingUp.js`, and the one-time conversions of old workspaces in `src/storage.js`. Screens live in `src/screens/`, shared pieces in `src/components/`.

Env vars (see `.env.example`): `ANTHROPIC_API_KEY`, `DATABASE_URL` (Neon Postgres), `DSB_PASSWORD` (owner dashboard at `/dsb`). Data is stored per anonymous browser id; there is no login yet.

**Database** (`db/schema.sql`): `users`, `goals`, `hobbies`, `projects`, `deadlines` (no longer written; old rows become tasks and projects, with a copy kept in `legacyDeadlines`), `tasks` and `ai_calls`, linked by real foreign keys (a task's project and goal; deleting a project unlinks its tasks, deleting a user removes everything of theirs). A visitor only gets a `users` row once they have content or use the AI. `users.email` and `users.auth_id` are ready for accounts. `api/_store.js` maps the app's one document to these tables, unknown fields land in each row's `extra` jsonb. Apply or re-run with `set -a; . ./.env.local; set +a; node scripts/migrate.mjs` (also copies the old `workspaces` / `usage` tables, which are kept as a backup).

Settings (gear): reminders (browser notifications, only while a tab is open), the timer, your calendar link, and JSON backup export/import.

    npm test   # unit checks for the pure logic in src/

**Chat** (Ask) is the only AI: it can propose tasks and projects, including from an attached syllabus, and adds them on a tap. It never schedules or says how to do the work.

**Public API** (`/api/v1/tasks`): `Authorization: Bearer <sync code>` (Settings > Sync code). `GET` lists, `POST {title, important, urgent, due, when, start, hours, readiness}` creates (setting `important` or `urgent` places the task yourself in the ranking, and `when` counts as the due date if none is given; at most 50 open tasks), `PATCH|DELETE ?id=<id>` edits or removes. 300 requests/hour per key. Reload an open tab to see API changes.

**Rate limits** (`api/_rate.js`, per id per hour, 4x per IP): AI 60, state 600, API 300. Over the limit: `429` with `Retry-After`; `X-RateLimit-Limit/Remaining` on every response. If the counter is down the request is refused (`503`).
