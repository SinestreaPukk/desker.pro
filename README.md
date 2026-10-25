# Desker

Goals, deadlines, tasks and a calendar, with an AI coach.

    npm install
    npx vercel dev   # runs the app and /api locally (load .env.local first: set -a; . ./.env.local; set +a)

Tabs (Tasks opens first): **Goals** (pyramid, happiness goals, hobbies), **Deadlines** (AI suggests tasks to pick), **Tasks** (Eisenhower matrix), **Do now** (compare ways to pick what to do), **Calendar**. The hero card at the top says what to do right now; the side panel is a planning coach.

Env vars (see `.env.example`): `ANTHROPIC_API_KEY`, `DATABASE_URL` (Neon Postgres, `workspaces` table). Data is stored per anonymous browser id; there is no login.

Tasks: done section with undo and weekly count, drag between boxes (or "Move to" in Details), steps, repeats. Calendar has month, week and day views; give a task a start time to see it as a block. Settings (gear): reminders (browser notifications, only while a tab is open) and JSON backup export/import.

    npm test   # unit checks for the pure logic in src/
