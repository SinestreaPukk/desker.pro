# Audit: /today (before the Yuki pixel theme)

Screenshots: `design/screens/before/` (full-390, full-768, full-1440, empty-390, empty-1440, loading-1440). Taken against the local Vite dev server with `/api/state` mocked.

## Stack

| Area | What is there |
|---|---|
| Framework | Vite 6 + React 18, plain JS/JSX. No router: `App.jsx` switches tabs with `history.pushState` (`/today /tasks /goals /projects /calendar`); `vercel.json` rewrites those paths to `index.html`. |
| Styling | Tailwind v4 (`@tailwindcss/vite`), tokens in `@theme` in `src/index.css`. Shared class strings in `src/ui.js` (`btn`, `ghost`, `BLUE`, `input`, `panel`, `rowCard`, `Q`, `LEVELS`). Many one-off hex colours inline (`bg-[#fdf1ee]`, `#f6d5cf`...). |
| Component library | None. Everything is hand-rolled; no shadcn/Radix. |
| Icons | `src/icons.jsx`: 7 inline-SVG outline icons (Today, Goals, Projects, Tasks, Calendar, Agent, Settings), plus ad-hoc inline SVGs (drag grip and "more" dots in `Row.jsx`). |
| Art | `src/art.jsx`: `Hero` (SVG pills banner), `Cover` (task card strip), `PageHead` (cover + overlapping icon + serif title), `Banner`. Logo is `/favicon.svg`. |
| Fonts | Instrument Sans + Instrument Serif from Google Fonts (`index.html`). No Thai or Japanese strings anywhere in `src/`, `api/`, `index.html`. |
| Backend | Vercel functions in `api/`. State is one JSON doc per anonymous `uid`; `api/state.js` drops any key not in `KEYS`, and `api/_store.js` `SETTINGS` lists the non-array keys that persist. |
| Tests | `node --test test/*.test.mjs` (logic only). No Playwright in the repo. |

## What `/today` renders, top to bottom

| # | Component | File | Shared with other routes? |
|---|---|---|---|
| 1 | Desktop header: logo, "Desker / Student planner", "Ask the AI agent" button, Settings gear, tab nav | `App.jsx` | **Yes, every route** |
| 2 | Mobile top bar (logo, tab name, "AI agent", Settings) | `App.jsx` | Yes |
| 3 | Mobile bottom tab bar (5 tabs + `Icon`) | `App.jsx` | Yes |
| 4 | `PageHead`: Hero SVG, icon tile, serif greeting, date + "finding" sentence, "Replan my week" link | `art.jsx` + `Today.jsx` | `PageHead` shared with Goals/Projects/Calendar via `Banner` |
| 5 | Getting-started dialog (first run only, empty data) | `Today.jsx` | No |
| 6 | Four stat `Tile`s: Do first, Due this week, Done this week, Free time today (number input) | `Today.jsx` | No |
| 7 | "Right now" panel: current pick card, Start/Done/Open timer/Stop buttons, minutes input, energy segmented control, "Ask the AI agent to plan my day", "More ways to choose" details (method picks, AI second opinion, `Energy`) | `Today.jsx` | `panel`/`btn` classes shared |
| 8 | "Coming up" list | `Today.jsx` | No |
| 9 | "Your tasks": add form + `Row` list | `Today.jsx`, `components/Row.jsx` | **`Row` shared** with Tasks, Projects, Goals |
| 10 | "This week" review card with `Bar` | `Review.jsx` | Also used on Goals |
| 11 | Toast (done / deleted + Undo) | `App.jsx` | Yes |
| 12 | Save-error banner, missed-tasks banner (other tabs) | `App.jsx` | Yes |
| 13 | AI agent side panel (chat, quick chips, attach, goal chips) | `components/Agent.jsx` | Yes (opens over any route) |
| 14 | Focus timer overlay | `Focus.jsx` | Yes |
| 15 | Settings popover (reminders, export/import) | `Settings.jsx` | Yes |
| 16 | Checkbox, range, number input, select, `details/summary` | `index.css` + inline | Yes |
| 17 | Loading state: bare `<p>Loading…</p>`. Empty states: one-line grey `<li>` or `<p>` per panel. | `App.jsx`, `Today.jsx` | Loading shared |

## Things the brief assumes that the app does not match

1. **Quadrant names.** The app says Do First / Schedule / Fit it in / Later, not Do now / Schedule / Delegate / Drop. "Do now" does not exist as a list: the nearest thing is the "Right now" panel. I keep the app's copy and map colours by position (see DESIGN.md).
2. **No avatar setting exists** and the profile has no identity. A picker has to be added, and `avatar` must be added to `SETTINGS` in `api/_store.js` or the server drops it.
3. **No coach avatar.** The agent is a plain panel with a chat-bubble icon. The bird becomes its face.
4. **"Done" is not one code path.** Completion goes through `setTasks` in `App.jsx` (Row checkbox, "Done" in Right now, Focus). The hanko hook belongs in `App.jsx` where the toast is already set.
5. **Meta text is built from middle dots** (`Task · Sat, Oct 31`, `Due … · 2h · Do First`). The slop linter flags this as a copy tell. It needs rewriting as separate chips or label/value pairs, not a regex swap.
6. **`src/ui.js`, `Row`, `PageHead` are imported by 19 files.** Restyling them changes every route. That is acceptable only because the token swap keeps the layout; routes will look cold-toned but not fully pixel until later.

## Baseline slop lint (before any change)

`slop_lint.py` over `src/`: 120 errors, 211 warnings. Over just the files `/today` touches (Today, components, App, ui, art, icons, Settings, Review, Focus): 47 errors, 65 warnings. Most are rounded corners, off-grid font sizes, opacity and hex colours.
