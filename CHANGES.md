# Changes (fix, refocus & redesign pass)

Status: **Phases 1 to 3 and 6 done. Phases 4, 5, 7, 8 follow (decisions recorded: kodama is the companion, migrations as files only, retune Yuki).**

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

## Tests
`npm test` (65 pass), `sh scripts/pixel-lint.sh` (0 errors). No typecheck script exists in the project.

## Not done yet, and why: see the questions at the end of the session.
