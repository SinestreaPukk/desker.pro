# Redesign Desker /today: "Yuki" pixel theme

You are redesigning the Desker web app, starting with the `/today` page (desker.dev/today). Desker is an AI planner built on the Eisenhower Matrix: goals, deadlines, tasks, a "Do now" list, a calendar and an AI coach chat. The goal is a calm, cold, Japanese-feeling pixel-art theme. Think a quiet snowy morning in Hokkaido, drawn as real pixel art.

This is a restyle, not a rebuild. Keep every feature, route, data flow and piece of copy that works today. Change how it looks and feels.

A design kit sits in `design/pixel-kit/`. Read all of it before you start:

- `reference/brix-reference.png`: the mood reference. Copy its composition and calm, not its colours. It's warm and autumnal, and we want winter.
- `reference/technique-demo.html`: a working example of a 9-slice pixel button and a blinking sprite avatar. Open it with Playwright.
- `art/palette/yuki16.json`: **the only colours allowed** in art and UI.
- `art/sprites/*.sprite.txt`: hand-authored text sprites. `shimaenaga` is the reference avatar, and `btn-frame` is the reference 9-slice frame. Match their quality bar and conventions.
- `tools/sprite_build.py`: compiles text sprites into 1x PNGs and sprite sheets.
- `tools/pixel_lint.py`: three checks. `sprite` checks the art rules, `render` checks that screenshots are crisp and use only palette colours, and `contact` builds a review sheet.
- `tools/slop_lint.py`: catches non-pixel CSS and generic AI-template tells.

Requirements: Python 3 with `pip install pillow numpy`.

---

## 0. Setup (do first)

1. Make a branch called `pixel-yuki-theme`. Commit at the end of each phase.
2. Install tooling if it's missing:
   - `/plugin install frontend-design@claude-plugins-official`. Follow its guidance for type, layout and restraint.
   - `claude mcp add playwright npx @playwright/mcp@latest` for live browser checks. Use `@playwright/test` too if the repo already has it.
3. Use plan mode for Phases 1–2.

## 1. Audit (no code changes)

- Identify the stack: framework, styling system (Tailwind or other), component library such as shadcn or Radix, icon set, fonts and theme tokens.
- Inventory every component rendered on `/today`, plus the shared ones it pulls in: nav, buttons, inputs, checkboxes, task rows, matrix quadrants, calendar bits, coach chat, avatars, dialogs, toasts, empty states and loading states.
- Take screenshots of the current `/today` at 390, 768 and 1440 px wide, plus at least one empty state and one loading state. Save them to `design/screens/before/`.
- Write `design/AUDIT.md` with the stack, the component list and the file locations, and say which components are shared with other routes.

## 2. Design plan (write `design/DESIGN.md`, then STOP for my approval)

Use the fixed decisions below. Fill in the open decisions with specifics for this codebase.

### Fixed decisions

**Palette (yuki16).** No other colours anywhere, including UI chrome. These are the token roles:

| Token | Palette | Use |
|---|---|---|
| `--bg` | yuki-0 `#F4F7F6` | page |
| `--surface-sunk` | yuki-1 `#DDE6EA` | inputs, wells, hover rows |
| `--line-soft` | yuki-2 `#B4C5D1` | dividers, bevel shadow |
| `--muted` | yuki-3 `#8394AE` | disabled, decoration only. **Never text** (2.9:1) |
| `--text-2` | yoru-0 `#5A6283` | secondary text (5.5:1 on bg) |
| `--primary` | yoru-1 `#3B4262` | primary button fill, text on it is yuki-0 (9.1:1) |
| `--ink` | yoru-2 `#252A40` | body text, outlines (13.1:1) |
| `--ice` / `--lake` | kori-1 / kori-2 | Schedule quadrant, links. On kori-2 use yuki-0 text only at ≥24px. On kori-1 use ink text |
| `--pine` | matsu-0/1/2 | Delegate quadrant, success, scenery |
| `--beni` | beni `#B4534A` | **the only accent**: Do now, overdue, the done stamp. yuki-0 text on it (4.6:1). Keep it under about 5% of any screen |
| skin/wood | hada-0/1, kuri | avatars and scenery only |

Ramps are already hue-shifted: shadows go blue-violet, highlights go cyan. Shade with the ramps listed in the JSON, never with opacity or `filter`.

**Pixel scale.** There are exactly two art-pixel units, and nothing else:
- `--px: 2px` everywhere for UI: frames, borders, shadow offsets, focus rings, icons and avatars. One sprite pixel is 2 CSS px, so a 16×16 icon is 32px and a 24×24 avatar is 48px.
- `--px-scene: 4px` at 1024px wide and up, and `2px` below that, for the scene banner and anything drawn inside it. The large avatar in the scene uses `--px-scene`.

Every border, offset and sprite size is an integer multiple of its unit. Art always has `image-rendering: pixelated`. If something needs to be smaller or bigger, draw a separate sprite at that resolution (for example a 16×16 face crop for dense lists). Don't scale it.

**Type.**
- **DotGothic16** (Google Fonts, built on a 16×16 grid, full Japanese coverage) for headings, body, buttons and nav. Use only 16, 32 or 48 px.
- **Fusion Pixel 12px Proportional JP** (`@fontsource/fusion-pixel-12px-proportional-jp`) for small meta text such as due times, counts and timestamps. Use only 12 or 24 px.
- **Thai strings, if the app has any:** first check whether a Thai pixel font with an OFL licence is worth using. Otherwise fall back to IBM Plex Sans Thai Looped through `unicode-range`, so Thai glyphs pick it up automatically.
- No Press Start 2P and no NES-style fonts. Sentence case everywhere. No tracked-out uppercase labels.

**The one memorable thing** is a snow scene banner at the top of Today, in the same spot as the reference's illustration. It's a small Japanese lakeside: pines, a snow-covered roof, a small vermilion torii as the only beni in the scene, still water and distant mountains. The user's avatar stands in the scene, like the character in the reference. The scene comes in three variants (morning, dusk and night) matched to the user's local time. Make the variants by **palette-swapping** one scene through a colour remap table, not by redrawing it. Everything else on the page stays quiet.

**Avatars.** Each avatar is a 24×24 sprite with a 2-frame idle (a blink every few seconds, `steps(1)`). The cast is all Japanese winter and all original. Don't use or resemble any existing character or mascot.
1. Shimaenaga, the snow-fairy bird. It's already in the kit and is the **AI coach's default face**.
2. Yuki-usagi: a snow rabbit with beni berry eyes and matsu leaf ears.
3. Kitsune in a knit scarf.
4. Nihonzaru: a snow monkey with a steam wisp.
5. Tanuki under a straw kasa.
6. Shiba in an earflap hat.
7. A chibi person in a beanie and scarf, with 3 hair colourways made by palette swap.

Avatars are 48px in nav, chat and profile (at `--px`). In the scene they're drawn at `--px-scene`. If a dense list needs something smaller, draw a 16×16 head-only sprite. The user picks theirs in settings, so wire the picker if a profile/avatar setting exists. If it doesn't, add a minimal one and tell me.

**Icons.** Replace the icon set on `/today` and shared nav with 16×16 pixel icons: today, matrix, goals (pyramid), calendar, coach, add, check, clock, flag, settings, close, send, and any others in use. Each icon uses at most 4 colours and a 1px stroke. Keep the existing accessible labels.

### Open decisions to fill in DESIGN.md

- An ASCII wireframe of `/today` at desktop and mobile. Keep the information order from the audit. The scene sits top right on desktop like the reference, and on mobile it becomes a full-width strip above the content.
- A component spec for each audited component: frame (9-slice or none), states (rest, hover, pressed, focus, disabled, loading), and which sprites it needs.
- Eisenhower quadrants as frame variants with a coloured tab: Do now uses beni, Schedule uses kori-2, Delegate uses matsu-1 and Drop uses yuki-3. Text colours follow the contrast table above.
- Completing a task stamps a small beni **hanko** seal sprite with a 2–3 frame stamp animation. That's the one celebratory motion. Don't use kanji in it unless it's legible at 1x.
- Snow: 1-art-pixel flakes inside the scene only, at most about 40, moving on whole art-pixel steps at about 8 fps. Pause them when the tab is hidden, and remove them under `prefers-reduced-motion`.

Before you finish DESIGN.md, review it against generic defaults. Ask yourself whether you'd have produced the same plan for any "retro pixel" brief. Where you would have, revise that part and note what changed. **Then stop and show me DESIGN.md. Don't touch app code until I approve.**

---

## 3. Pixel-art rules (non-negotiable; the linters enforce most of them)

1. **Grid integrity.** Store art at 1x as PNG. Scale only by integers in CSS with `image-rendering: pixelated`. Position on whole art pixels. Never use rotation, skew, non-integer `scale()`, `filter`, opacity on art, or blurred shadows. Flip horizontally only.
2. **Palette discipline.** Use yuki16 colours only, with no semi-transparent pixels. Colour limits: icons 4, avatars and props 12, scenes 16.
3. **Clean lines.** Use 1px outlines with no doubles (L-shaped jaggies) and no 2×2 clumps. Slopes use consistent steps (1:1, 1:2, 2:1, 1:3). Curves use run lengths that grow or shrink steadily, like the shimaenaga body.
4. **Light** comes from one source, upper-left, everywhere. Shade the form. No pillow shading (darkening every edge evenly), and no banding (colour steps lining up in parallel).
5. **Orphan pixels** are allowed only as intentional glints or stars.
6. **Outlines.** Avatars and icons get a full yoru-2 outline so they read on the light UI. Large scene props may use selective outlines (sel-out).
7. **Dithering** is allowed only in large gradations like sky and water, using an ordered 2×2 or checker pattern. Never dither small sprites. Never use noise.
8. **Readability.** Every sprite must read at 1x and as a solid silhouette. Check with `pixel_lint.py contact`.
9. **Animation** uses few frames, `steps()` timing, 4–8 fps and hold frames. UI motion is a 1-art-pixel press (`translateY(var(--px))`) with `steps(1)` or `steps(2)`. No ease curves or fades on pixel elements.
10. **No automatic anti-aliasing.** Manual AA is allowed only on large curves, sparingly, using palette colours.
11. **Composition.** Scenes are built from a 16×16 tileset plus a few larger props, put together in a text tilemap and rendered to one PNG by a script. Extend `sprite_build.py` or add `scene_build.py`. Don't hand-type a 200×100 grid.
12. **No fake pixel art.** Don't ship AI-generated images, upscaled photos, CSS `dashed` borders pretending to be pixel edges, NES.css, 98.css, CRT scanlines or neon. If you use any generator for concepting, redraw the result by hand on the grid. Shipped art comes from `.sprite.txt` or tilemap sources only.

## 4. Anti-slop rules (design level, beyond the linter)

- Frames go only on real containers. Don't chop the page into identical framed cards.
- No eyebrow labels, no numbered markers unless the content really is a sequence, and no "→" on buttons. Buttons say exactly what happens ("Plan my day", "Add task", "Send"). A toast repeats the action's verb ("Task added").
- Don't put a sparkle "AI" icon on the coach. The coach is the bird.
- Empty states give direction. "Nothing due today. Add a task or ask the coach to plan tomorrow." is the right tone; mood copy isn't.
- Keep it calm: no motion except the snow, blinks and the stamp. Snow stays inside the scene.
- Don't use cream or warm backgrounds or terracotta. This theme is cold.

## 5. Build order (after approval)

1. Tokens and base: CSS variables, the `--px` breakpoints, fonts, a global `.px-art { image-rendering: pixelated }`, and a focus ring made of a 1-art-px ink outline plus a 1-art-px bg offset.
2. Art pipeline: put sources in `art/sprites` and build to `public/pixel/`. Add `npm run pixel:build`, plus `npm run pixel:lint` for the sprite and slop lints.
3. Primitives: Button (primary, secondary, danger), Input, Textarea, Checkbox (8×8 sprite states), Tabs, Panel frame, Avatar (sheet plus blink), Icon, Divider (a dotted 1-art-px pattern), Tooltip, Toast and Dialog. Make hit targets at least 44 px.
4. `/today` sections in audit order, then the scene banner last.
5. Shared nav and anything else `/today` imports. Don't restyle other routes yet, but make sure they still render.

## 6. Verification loop (repeat until clean; paste results into the PR)

1. `python3 design/pixel-kit/tools/pixel_lint.py sprite public/pixel --palette design/pixel-kit/art/palette/yuki16.json --max-colors 12`. Use `--max-colors 4` for icons and `--max-colors 16 --grid 16` for scenes. Zero errors. Fix every warning, or justify it in `design/ART_NOTES.md` with the coordinates.
2. `python3 design/pixel-kit/tools/slop_lint.py src app components` (adjust the paths to the repo). Zero errors. Suppress a line only with `pixel-ok: <reason>`.
3. Add a Playwright spec, `tests/pixel-render.spec.ts`. It visits `/today` at 390, 768 and 1440 px wide, at DPR 1 and 2. It takes element screenshots of every avatar, icon, frame edge and the scene, then runs `pixel_lint.py render --scale <element's unit in CSS px × DPR> --palette … --bg '#F4F7F6'` on each one. For example, a UI icon at DPR 2 uses scale 4, and the desktop scene at DPR 1 uses scale 4. All must pass. Crop out text, because text is exempt.
4. Build a contact sheet with `pixel_lint.py contact public/pixel --out design/screens/contact.png` and **look at it**. Check that each sprite reads at 1x and that the silhouettes are distinct.
5. Take after-screenshots at all three widths, for morning, dusk and night, and for the empty and loading states. Save them to `design/screens/after/` and **look at every one**. Compare them against the reference for calm and composition.
6. **Independent review.** Spawn a fresh subagent that hasn't seen your work. Give it only the after-screenshots, the contact sheet, `reference/brix-reference.png`, sections 3–4 of this prompt and the frontend-design guidance. Ask it to grade each rule pass/fail with evidence, list the five weakest spots, and say whether any of it looks generic or AI-generated. Fix the issues it finds and run it again. It must come back with no fails.
7. Accessibility: check the contrast pairs from the token table, keyboard through the whole page with a visible focus ring everywhere, confirm `prefers-reduced-motion` stops the snow and the blinks, and confirm screen-reader labels survived the icon swap.
8. Regression: the build passes, existing tests pass, there are no console errors, and other routes still load.

## 7. Deliverables

- The branch, with commits per phase and a PR whose description includes before/after screenshots and the lint output.
- `design/AUDIT.md`, `design/DESIGN.md`, `design/ART_NOTES.md`, `design/screens/`.
- All art as `.sprite.txt` and tilemap sources plus built PNGs, and `npm run pixel:build` and `npm run pixel:lint` scripts.
- A short note listing what you couldn't finish or deliberately left for other routes.
