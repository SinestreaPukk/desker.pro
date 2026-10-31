# Design plan: Yuki pixel theme for /today

Status: **awaiting approval. No app code has changed.** Branch `pixel-yuki-theme`. Kit is at `pixel-kit/` (not `design/pixel-kit/`); I will use it where it is unless you want it moved.

The prompt's fixed decisions (palette, `--px`/`--px-scene`, fonts, rules) are adopted as written. This file only covers what the codebase forces and the open decisions.

## 1. Scope decisions

- **Scope of restyle:** `/today` fully; shared nav, toast, agent panel, Row, buttons and inputs because Today imports them. Other routes get the new tokens and primitives through shared classes and must still render, but their own hex colours and rounded cards stay for a later pass. They will look half-themed. I would rather say so than hide it.
- **Token swap, not a Tailwind rewrite.** Keep Tailwind. Redefine the existing `@theme` names (`--color-primary`, `line`, `panel`, `ink`, `accent`...) to yuki16 values, then add `--px`, `--px-scene` and the font vars. Existing class names keep working; `ui.js` strings change in one place.
- **Border radius goes to zero everywhere** (`--radius-*: 0`). Frames come from 9-slice PNGs, not `border-radius`.
- **Lint scope:** `slop_lint` is run on the files `/today` imports plus new files. Other routes will not pass yet (see AUDIT: 120 errors repo-wide). I will report the remaining count rather than silence it.
- **Fonts self-hosted** through `@fontsource/dotgothic16` and `@fontsource/fusion-pixel-12px-proportional-jp` (both OFL-1.1, verified on npm). That also drops the Google Fonts request. There is no Thai in the app, so no Thai fallback is shipped; add one only if Thai copy appears.

## 2. Quadrant mapping (copy kept, colours by position)

| App name | Prompt's role | Tab colour | Text on it |
|---|---|---|---|
| Do First | Do now | beni | yuki-0 (4.6:1) |
| Schedule | Schedule | kori-2 | yuki-0 at 24px+ only, else ink on kori-1 body |
| Fit it in | Delegate | matsu-1 | yuki-0 |
| Later | Drop | yuki-3 | ink (yuki-0 on yuki-3 fails) |

The tab is a small coloured label tab on the frame; the body of the card stays yuki-0/1 with ink text, so contrast is carried by the body, not the tab, except for the 24px+ cases above.

## 3. Wireframes

Information order is unchanged from the audit: greeting + finding, stats, Right now + Coming up, Your tasks + This week.

Desktop (1440, content column 1100 max):

```
+--------------------------------------------------------------------------+
| [bird 48] Desker   Today Tasks Goals Projects Calendar   [Ask the AI agent] [gear] |
+--------------------------------------------------------------------------+
| Good evening.                      |  ~~~~ snow scene 192x80 art px ~~~~ |
| Friday, October 30.                |  mountains, pines, roof, torii,     |
| Finish lab report is due Sat.      |  lake, YOUR AVATAR on the shore     |
| [Replan my week]                   |  (768 x 320 css px at 4px)          |
+--------------------------------------------------------------------------+
| Do first 1 | Due this week 4 | Done this week 0 | Free time today [4]      |
+-------------------------------------------+------------------------------+
| Right now  [tab: beni]                    | Coming up (4)    View all    |
|  Finish lab report                        |  row / row / row / row       |
|  Calendar plan, 120 min, top priority     |                              |
|  [Start]                                  |                              |
|  Minutes [60]  Energy (Low|Medium|High)   |                              |
|  [Ask the AI agent to plan my day]        |                              |
+-------------------------------------------+------------------------------+
| Your tasks (4)  [Add a task____][Add]     | This week                    |
|  [ ] Finish lab report  [Start] [...]     |                              |
+-------------------------------------------+------------------------------+
```

Mobile (390):

```
[bird] Today        [AI agent] [gear]
+--------------------------------+
| scene strip, 176 art px wide   |   2px per art px = 352 css px, centred crop
| (cropped 8 art px each side)   |   160 css px tall
+--------------------------------+
Good evening.
Friday, October 30. Finish lab report is due Sat, Oct 31.
[Do first 1][Due 4]  [Done 0][Free 4]
Right now ...  (Start button visible without scrolling at 844 tall)
...
[Today][Tasks][Goals][Projects][Calendar]   (16x16 icons at 32px, 64px tall bar)
```

The scene is 192×80 art px on purpose. The reference illustration is taller, but the earlier commit history shows the Start step was deliberately kept on screen, and at 4px a 192×96 scene is 384px tall, which pushes it below 900px viewports. 24px of avatar in 80px of height is bigger relative to the scene than the reference's character; I accept that so the avatar stays legible at 1x.

## 4. Component spec

States for all interactive pieces: rest, hover (yuki-1 fill, no motion), pressed (`translateY(var(--px))`, `steps(1)`), focus (1-art-px ink outline + 1-art-px bg gap), disabled (yuki-1 fill, yoru-0 text, no frame shadow), loading (label swaps to the same verb + "…", dots do not animate). Min hit target 44px.

| Component | Frame | Sprites |
|---|---|---|
| Button primary | 9-slice `btn-frame` recoloured: yoru-1 fill, yoru-2 outline, yuki-0 text | `btn-primary`, `btn-secondary` (yuki-0 fill), `btn-danger` (beni fill) |
| Input / Textarea / number | 9-slice, yuki-1 sunk fill, ink outline, inner top shadow row | `field-frame` |
| Checkbox | none, 8×8 sprite at 16px (hit area padded to 44) | `check-off`, `check-on`, `check-focus` is the ring, not a sprite |
| Segmented energy control | one `panel` frame, selected segment sunk | reuses `field-frame` |
| Tabs / nav | no frame; active tab gets a 2-art-px ink underline with a beni notch only on Today if overdue | none |
| Panel | 9-slice `panel-frame`: yuki-0 fill, yuki-2 outline plus yuki-2 shadow row, quadrant tab variants | `panel-frame`, `panel-tab-{beni,kori,matsu,yuki}` |
| Row (task) | no frame of its own, divided by dotted 1-art-px divider | `divider-dot`, drag grip 8×8, more-dots icon |
| Stat tile | `panel-frame`, number in Pixelify Sans 32 | none |
| Avatar | none; 24×24 two-frame sheet, 48px | 7 `.sprite.txt`, `avatar-*` sheets |
| Toast | `panel-frame` in yoru-1 fill with yuki-0 text, bottom-left | none; copy repeats the verb ("Task done: ...") |
| Dialog (getting started) | `panel-frame` centred, backdrop is a solid yoru-2 checker, not opacity | `backdrop-checker` |
| Agent panel | right panel `panel-frame` edge; messages in field frames; bird avatar 48px beside assistant messages | shimaenaga |
| Tooltip | `panel-frame` small | none |
| Review bar | segmented blocks in `--px` steps with ramp colours | none (CSS blocks) |
| Divider | dotted 1-art-px repeat | `divider-dot` |

## 5. Hanko, snow, avatars

- **Hanko:** 16×16 beni seal, 3 frames (press down 1 art px, settle, hold). Shown on the row that was completed, `steps(3)` over ~375ms, then fades by being removed, not by opacity. No kanji; it is a plain beni square seal with a notched corner and a small 2×2 glint, which stays legible at 1x. Hook: `setTasks` in `App.jsx` already knows `r.finished`. Reduced motion: shows the final frame only.
- **Snow:** one `<canvas>` or a fixed list of ≤40 absolutely positioned 1-art-px divs inside the scene container only, stepping on whole art pixels at 8fps. Stops on `visibilitychange` hidden; not rendered under `prefers-reduced-motion`.
- **Avatars:** seven 24×24 sprites with an idle blink. Shimaenaga is the coach's face; the user's own avatar is chosen in Settings (new "Your avatar" row in `Settings.jsx`, stored as `data.avatar`, added to `SETTINGS` in `api/_store.js`). Default for a new user: shimaenaga is the coach, the user default is the chibi person in beanie, hair colourway 1. Three chibi colourways come from a palette remap in the sheet build. The scene draws the user's avatar at `--px-scene`.

## 6. Scene, palette-swapped

One tilemap source (`scene_build.py` or an extension to `sprite_build.py`: 16×16 tileset plus larger props, a text tilemap, rendered to one PNG at build time). Variants are built by remap tables in the build, never redrawn:

| Variant | Window | Sky | Water | Notes |
|---|---|---|---|---|
| Morning (05:00 to 11:59) | cold | kori-1 over yuki-0, checker dither | kori-1/yuki-1 | torii beni only |
| Dusk (12:00 to 18:59) | hada-0 glow | hada-1 and kori-1 checker low on horizon | yoru-0/kori-2 | the one warm moment: hada, still no new accent |
| Night (19:00 to 04:59) | hada-0 lit | yoru-1 and yoru-2 checker, a few 1px yuki-0 stars | yoru-2/yoru-1 | snow reads brighter |

Time bands use the browser's local hour. Remap tables map palette entry to palette entry, so the 16-colour budget and lint hold by construction.

## 7. Icons

16×16, ≤4 colours, 1px yoru-2 stroke, drawn as `.sprite.txt` and built into one icon sheet: today (sun over horizon), tasks (matrix of four), goals (pyramid), projects (folder), calendar, coach (small bird head, not a chat bubble), add, check, clock, flag, settings, close, send, more-dots, grip. Existing `aria-label`s and the `Icon name` API stay, so call sites do not change.

## 8. Build order and risk

1. Tokens, fonts, `--px` breakpoints, `.px-art`, focus ring. 2. Art pipeline: `pixel:build` and `pixel:lint` scripts, sources in `art/sprites` (new dir in the repo), output to `public/pixel/`. 3. Primitives. 4. Today sections in order, scene last. 5. Shared nav, toast, Agent, Row.
Biggest risks: (a) hand-authoring 7 avatars, ~15 icons and a 192×80 scene at lint quality is the real cost, and I will deliver them in that order so you can stop early; (b) DotGothic at 16px only is a large body size that changes density, so some rows will wrap on mobile; (c) 12px Fusion Pixel meta text is small, so I will keep it to non-essential meta and check it in screenshots.

## 9. Review against generic defaults (what I changed)

My first draft was a standard retro-pixel page: framed cards everywhere, pixel icons, a pixel mascot top-left, press-start-style headings. Revised:
- Only five things get frames: panels holding real content, buttons, fields, toast, dialog. Rows, stats and lists are unframed and separated by the dotted divider.
- The bird is the coach, and the user's own avatar lives in the scene, so identity is in the one place that matters, not a mascot in the corner.
- Dusk and night carry the time-of-day idea; there is no theme toggle.
- The nav has no pixel decoration beyond icons. No scanlines, no glow.
- Copy stays plain and functional. Nothing is renamed to sound Japanese.

## 10. Decisions I need from you

1. **Quadrant colours by position** (Fit it in = matsu, Later = yuki-3): ok?
2. **Add `avatar` to `api/_store.js` SETTINGS** (a one-line server change): ok?
3. **Other routes stay half-themed** this round: ok?
4. **Scene height 192×80** (320px on desktop) rather than the reference's taller crop: ok?

## As built (addendum after approval)

Your answers: 1 ok (quadrants by position), 2 ok (`avatar` in `SETTINGS`), 3 "do the best that leads to pixel art", 4 ok (192x80).

- **Decision 3:** I went further than token-only. Every `rounded-*`, shadow, `transition`, off-palette hex and opacity colour in `src/` was swept, so other routes are square, 2px-bordered and on the palette. They still use the old layouts. `slop_lint` over all of `src/` is at 0 errors, 0 warnings.
- **Mobile:** the scene crops 24 art px of empty sky (`--crop`) so the Start button sits at y=741 on an 844px screen, above the 64px tab bar.
- **Stat captions** hide below 1024px (except Free time, which needs its note).
- **Dusk** keeps the snow cold; only the horizon band turns hada-1, plus the window glow.
- **Avatar picker** lives in Settings (3 beanie colourways plus the six animals). Nav shows the user's avatar; the chat shows the shimaenaga.
- **Hanko** plays in the "Done" toast, because the finished row leaves the Today list at once and could not show it.
- **Not built:** Tooltip and a standalone Dialog component (the one dialog, Getting started, uses the panel frame and checker backdrop directly), and 16x16 head sprites.
- **Font changed after review (your request):** DotGothic16 was hard to read at 16px, so body and headings now use **Pixelify Sans** (OFL, game-style). Sizes are 16 small, 20 body, 32 and 48. Fusion Pixel stays only as the fallback for Japanese glyphs. Ligatures are off because Pixelify's "fi" renders as a different glyph. This overrides the original 16/32/48 and 12/24 rule.
- **One avatar only (your request):** the other eight avatars and the Settings picker were removed (they stay in git history). `av-main` is now the logo (header, browser tab, PWA icons), the person in the scene and the coach's face. The art is the kit's **shimaenaga**, copied unchanged (the kid I had drawn from the mood reference was wrong and is deleted). The `avatar` setting and its server key were dropped again, so `api/_store.js` is unchanged from `main`.
- **Calmer motion:** snow is down to 6 flakes; two clouds drift a pixel a second and a few sparkles come and go on the lake (palette-swapped per variant via `src/scene-motion.json`).

### Scene redo (as built)

The banner is now drawn in code, plane by plane, in role colours (`art/scene_build.py`); night is the master and morning and dusk are palette remaps. Added: a moon with a graduated dither halo, a lake with mirrored reflections and a moon path, a torii in the shallows, a gassho-zukuri farmhouse with a stepped light pool, irregular snow-laden pines, a foreground rock with reeds and a pine bough. The avatar is `av-scene` (branchless) perched on a dock post at the right third line. Motion: two snow layers (behind and in front of the avatar), the blink, and a 2 fps slide of three dashes on the moon's path. The old drifting clouds and lake sparkles are gone. Everything stops under `prefers-reduced-motion`.

### Milestones and the kodama (as built)

Goals carry `milestones: [{ id, title, at? }]` (`at` is the local day it was reached; stored in the goal's `extra` jsonb, so no migration). `src/milestones.js` holds the rules: a milestone reached today makes the kodama happy (hops); one reached yesterday makes today a lucky day (sparkles and a leaf sprout, plus a "Lucky day" tag when both apply); otherwise it stays as it is (idle blink, no sad state). The kodama is traced from the character sheet (`art/authoring/kodama_trace.py` -> `kodama_head.txt`, then `gen_kodama.py` -> `kodama.sheet.png`): 32x32, six frames, drawn at `--px`. It is the one exception to yuki16: it uses `art/palette/kodama.json` (8 colours sampled from the sheet: lime head, teal legs, orange blush, dark brown line), because the palette has no bright green and the character has to match the sheet. It shows on Today (header from 640px up, below the Right now panel on phones, so the Start button stays above the tab bar) and on Goals. "Lucky day" is a status and a message for now; it changes nothing else.

### Seasons (as built)

The banner now follows the calendar as well as the clock: `scene-{winter,spring,summer,autumn}-{morning,dusk,night}.png` (12 images, 192x80). The pixels are the same; each season is a role-to-colour table in `art/scene_build.py` (`SEASONS`), plus how far the snow reaches down the peaks (`SNOWLINE_AT`). Roof, shrine/post/rock caps, pine clumps and the top-right bough have their own roles so they can turn into straw, moss, leaves and blossom. Seasons are the northern meteorological ones (Dec-Feb winter, Mar-May spring, Jun-Aug summer, Sep-Nov autumn); `?season=summer` overrides it for previews. What falls changes with the season: snow, blossom petals, autumn leaves, nothing in summer. Winter and the covers keep the snow look.

### Kodama redesign (as built)

The kodama now comes from the four-pose pixel sheet (`kodama_read.py` reads the 8px grid, `kodama_poses.py` quantises and cuts the poses, `gen_kodama.py` builds `kodama.sheet.png`: 44x44, six frames, drawn at `--px`, palette `art/palette/kodama.json`). Default (idle) is the leaf-play pose with a blink; happy is the jumping pose with a 2px hop; lucky is the waving pose with sparkles. The log pose is cut from the sheet but not used yet. The sparkles and the blink are the only parts not on the sheet.
