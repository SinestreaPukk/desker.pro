# Desker

Goals, deadlines, tasks and a calendar, with an AI agent.

    npm install
    npx vercel dev   # runs the app and /api locally (load .env.local first: set -a; . ./.env.local; set +a)

Look (tasteskill v2, editorial greeting): white ground, tonal pale-blue panels (`#f3f6fc`), Instrument Serif for the greeting and Instrument Sans for everything else, ink `#14213d`, calm pastel blue `#b4caf0` for primary actions and active states, deep `#35599a` for links. Shadows only on floating things (menus). Colours and radii live in the `@theme` block of `src/index.css`; shared classes in `src/ui.js`; icons in `src/icons.jsx`. Check changes with `node .agents/skills/design-taste-frontend/scripts/lint.mjs --app src`.

Routes: `/today`, `/tasks`, `/goals`, `/projects`, `/calendar` (`/` and `/do-now` go to Today). `vercel.json` rewrites them to `index.html`.

Layout:
- **Desktop:** a top header with the logo (click for Today), "Ask the AI agent" and Settings, and a tab row for the five sections. Tasks shows the Eisenhower matrix as four board columns of cards.
- **Phone:** logo, page title, AI agent and Settings on top, and a bottom tab bar. Inputs are 16px so iOS doesn't zoom.

Sections (Today opens first): **Today** (greeting, key numbers, "Right now" with ways to choose, coming up, your tasks, weekly review), **Tasks** (add, Eisenhower matrix or list, AI prioritise), **Projects** (something bigger than a task: an investment, exam or test; it owns tasks via `projectId`, shows progress, and the AI breaks it into tasks), **Goals** (pyramid, happiness goals, hobbies), **Calendar**. Every page opens with a Notion-style head (cover art, an icon on its edge, a big serif title). On the Tasks board each card has cover art and tag chips (box, due date, hours, steps, repeat). Screens live in `src/screens/`, shared pieces in `src/components/` and `src/shared.jsx`. The previous UI is kept in `legacy/`.

Env vars (see `.env.example`): `ANTHROPIC_API_KEY`, `DATABASE_URL` (Neon Postgres, `workspaces` table). Data is stored per anonymous browser id; there is no login.

Tasks: done section with undo and weekly count, drag between boxes (or "Move to" in Details), steps, repeats. Calendar has month, week and day views; give a task a start time to see it as a block. Settings (gear): reminders (browser notifications, only while a tab is open) and JSON backup export/import.

    npm test   # unit checks for the pure logic in src/

Also: **Replan my week** (Calendar, the AI agent, or the banner when planned tasks slip) shows what moves and what is at risk before you apply it; a weekly goal-alignment card on Goals; energy check-ins in Today that teach the planner your best hours; a Pomodoro focus timer that logs real time on tasks; syllabus import in Deadlines.

**Public API** (`/api/v1/tasks`): `Authorization: Bearer <sync code>` (Settings > Sync code). `GET` lists, `POST {title, important, urgent, due, when, start, hours, readiness}` creates, `PATCH|DELETE ?id=<id>` edits or removes. 300 requests/hour per key. Reload an open tab to see API changes.

**Rate limits** (`api/_rate.js`, per id per hour, 4x per IP): AI 60, state 600, API 300. Over the limit: `429` with `Retry-After`; `X-RateLimit-Limit/Remaining` on every response. If the counter is down the request is refused (`503`).

**Deadlines live in Tasks.** A dated task is a deadline. "Check with AI" in a task's panel decides if it is one task (kept as is) or several (you choose to split; it then becomes a deadline card that owns the new tasks, and you can add your own tasks to it). Syllabus import is on the Tasks page. `/deadlines` opens Tasks.
