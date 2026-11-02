# Kodama Village: Claude Code build pack

This pack turns the Kodama Village product plan into prompts you can give Claude Code, one phase at a time.

## Files

| File | What it is | How to use it |
|---|---|---|
| `01-village-spec.md` | The full technical spec: the single source of truth for every phase | Commit it to the repo as `docs/village/SPEC.md` **before** Phase 0 |
| `phase-0-prototype.md` | 2 weeks. Does a friend group actually study together in it? | Paste into Claude Code in plan mode |
| `phase-1-mvp.md` | 4–6 weeks. Real villages, invites, Board, Focus, phones, safety | Paste after Phase 0 passes its gate |
| `phase-2-make-it-yours.md` | 4–6 weeks. Decorating, kodama customisation, Leaves, LINE | Paste after Phase 1 passes its gate |
| `phase-3-campus.md` | Later. Public study halls, course intelligence, payments | Paste after Phase 2 passes its gate |

## Setup (once)

1. Copy `01-village-spec.md` into the repo at `docs/village/SPEC.md`.
2. Add these lines to the repo's `CLAUDE.md` (create it if it doesn't exist):

   ```markdown
   ## Kodama Village
   - Spec: docs/village/SPEC.md is the source of truth for village.desker.dev. Read it before any village work.
   - If code and spec disagree, stop and ask. Don't silently change either.
   - Never change existing Desker tables without asking. New tables are prefixed `village_`.
   ```

3. Commit both, so every Claude Code session starts with the same context.

## Running a phase

1. Start Claude Code in **plan mode** (Shift+Tab until it says plan mode).
2. Paste the phase file.
3. Read its plan carefully. Approve, or push back on anything in the "decisions to confirm" list.
4. Let it build. It will stop at the checkpoints written into each phase. Test at each one yourself.
5. At the end, run the phase's demo script with real friends, then check the gate.

## The gates (don't skip them)

| After | Gate to pass before moving on |
|---|---|
| Phase 0 | 3 friend groups each study in it 3+ times in a week, without you pushing them |
| Phase 1 | Most villages still have 3+ active members after 4 weeks |
| Phase 2 | Students in villages stay on Desker longer than planner-only students |

If a gate fails, run a fix-up session for that phase instead of starting the next one. Ask Claude Code: "Phase N didn't pass its gate because ___. Read SPEC.md and propose the smallest changes that address it."

## Tips

- Keep each Claude Code session to one checkpoint where you can. Long sessions drift.
- After each checkpoint, ask it to update the "Status" section at the bottom of `docs/village/SPEC.md`.
- When something feels wrong in the world (movement, bubbles, sounds), describe the *feel* precisely: "movement feels floaty and late" is more useful than "fix movement".
