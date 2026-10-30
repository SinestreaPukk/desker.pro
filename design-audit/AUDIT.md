# Desker Pro: Today and platform redesign audit

Goal: make Today the first place a student opens when they don't know what to do (retention first).
Screenshots: `before/` and `after/`, named `<fresh|seeded>-<page>-<390|1440>.png`. Fresh = new browser profile, seeded = `seed.mjs`.
Re-run everything: `npm run dev`, then `node design-audit/shoot.mjs after`, `node design-audit/axe.mjs`, `node design-audit/overflow.mjs`, `node design-audit/verify.mjs`.

## Issues on Today

| # | Issue | Guideline broken | Fix | Roadmap goal | Status | Before / after |
|---|---|---|---|---|---|---|
| 1 | Banner art and a huge "Good evening." push the next step below the fold | A2 only key content, A3 data-ink, A8 hierarchy | Slim greeting header, Do now hero first. Banner and cover art deleted on every page | Daily: one clear next step | Fixed | [before](before/seeded-today-390.png) / [after](after/seeded-today-390.png) |
| 2 | Tiles have no context; "Free time today" is an input posing as a number | A9 context, A10 labels, B7 ask for less | `StatTile` (label, number, context). Do First warns on overdue, Done compares with last week, Free time is "4 h" with an Edit control | Weekly mirror | Fixed | same |
| 3 | The same task appears three times | A2, A7 | One Do now, one merged Coming up (excludes the Do now task), "Your tasks" card removed | Daily | Fixed | same |
| 4 | Three differently worded AI buttons | B4 consistency, B6 naming | Header "Ask the AI agent" is the only global entry. Contextual buttons use the agent's own prompts: "Help me plan my day", "Weekly review", "Replan my week" | All | Fixed | same |
| 5 | "This week" fails as a mirror: "0h / 0.8h", all-grey bar, six-item legend, three similar blues | A4 rounded numbers, A5, A9, B2 not colour alone | Stacked bar of time by goal level with labelled rows (hours and %), zero levels hidden, one insight line ("20% of your time had no goal"), context vs last week. Weekly review is promoted to primary on Sun/Mon | Weekly mirror | Fixed | same |
| 6 | Primary Start looks disabled; low-contrast links; tiny label | B2 contrast | Primary is solid dark blue with white text everywhere. Disabled buttons look disabled (grey, border) | Daily | Fixed | same |
| 7 | Unbalanced grid, dead space | A8 | Desktop: Do now (8 cols) over KPI strip and mirror, right column for Coming up, Something for you and setup. Mobile: Do now, KPIs, mirror, coming up | Daily | Fixed | [after 1440](after/seeded-today-1440.png) |
| 8 | Free minutes and energy always visible; no reason for the task; fun not planned | B5 progressive disclosure, B7 | "Adjust" disclosure holds minutes, energy, "I’m stressed / low energy". `ReasonLine` shows box + goal, or "No goal yet · Link one" (a goal picker). "Something for you" from fun tasks, hobbies and happiness goals | Daily, goal linking | Fixed | same |
| 9 | New users see zeros | B1 user needs | First-run "Get started" checklist, five steps that tick themselves, one tap each. Prioritise with AI runs from Today | Onboarding | Fixed | [before](before/fresh-today-390.png) / [after](after/fresh-today-390.png) |

## Platform-wide

| Item | Status |
|---|---|
| Tokens (`src/index.css`, `src/ui.js`): 4px spacing, six type sizes, radius and elevation notes, semantic colours, Thai font fallback and line heights | Done |
| Two fixed colour sets in `src/ui.js`: four Eisenhower boxes (`Q`) and six goal levels (`LEVELS`, `FUN`, `NO_GOAL`), used on Today, Tasks matrix, Goals pyramid, Calendar chips, always with text labels | Done |
| Shared components `src/components/ui.jsx`: Button (4 variants, real disabled state), Card, SectionHeader, StatTile, EmptyState, ReasonLine, Skeleton, PrivateWarning. All 57 old button class strings now use Button | Done |
| One date and duration utility `src/format.js` (`fmtDate`, `fmtDuration`, `relDate`), tested. "0.8h" is now "48 min" everywhere | Done |
| Bottom tab bar at ≤768px, safe-area insets, no horizontal scroll at 360px (found and fixed overflow on Goals and Calendar) | Done |
| Settings trust UI: "Account & sync" explainer, masked sync code with Reveal and Copy, private warnings on the sync code and calendar link (the calendar link contains the sync code, so the warning says so), labelled Export and Import | Done |
| Loading skeleton and a load-error state with a Retry action. Empty states on Do now, mirror and Coming up | Done |
| Analytics `src/track.js`: off unless `VITE_TRACK=console`. Events: app_open, do_now_shown, do_now_started, goals_guide_step, goals_guide_completed, weekly_review_opened, task_linked_to_goal, onboarding_step_completed, replan_week_clicked. Props are ids, counts and step names only. The analytics id is separate from the sync code | Done |

## Deferred (TODO comments in code, no fake buttons)

| Item | Waits on |
|---|---|
| Focus timer plugged into Start (today Start opens the existing simple timer) | Phase 1 focus timer |
| Stored streak (the chip shows a streak derived from finished-task dates) | Phase 1 streaks |
| Scheduled Sunday weekly-review ritual (today it is a Sun/Mon highlight) | Phase 1 |
| Sign in with Google, Reset sync code, Read-only calendar link | Next-30-day items |
| Sending events to a real analytics provider | "Measure the habit" |
| "Something for you" picks by daily rotation, not by fitting today's gaps | Only if people ignore it |
| Per-block error states for AI calls on other pages are the existing inline messages, not redesigned | Later pass |

## Verification

- Typecheck and lint: the repo has neither configured (plain JS, no ESLint), so nothing to run. Production build passes. Tests: 36 pass (added format and insight tests).
- axe-core (WCAG 2.2 AA tags), all five pages, fresh and seeded, 390 and 1440: **zero serious or critical**. It found one issue on the way (Calendar day buttons under 24px), now fixed.
- Lighthouse, Today, mobile, production build with mock data: **Accessibility 100, CLS 0.000**. Performance 89 (LCP 3.7s on simulated slow mobile, mostly the Google Fonts request).
- Keyboard pass on Today: every control is reachable (Tab), every stop has a visible focus ring and an accessible name, Enter on Start opens the timer. Not tested with a real screen reader.
- 5-second test, seeded Today: Do now title and Start are above the bottom tab bar at 390x844 (Start ends at 425px of 797px) and at 360x640 (449px of 593px).
- First run: fresh profile to first recommended task in **4 actions** (tap "Add tasks", tap the field and type, tap Add, tap Today). Scripted run time 1.9 s, which only shows there are no waits. A real user's time is **not measured**; the target of under 3 minutes needs a test with people.
- Thai: a long Thai title wraps without clipping marks or overflowing at 360px ([screenshot](after/seeded-today-thai-360.png)).
- Bug caught by the first-run test: the shared Button defaulted to `type="button"`, which stopped every converted form submit button from submitting. Fixed by removing the default.
