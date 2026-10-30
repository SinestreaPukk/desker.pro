# Desker pixel kit ("Yuki" theme)

1. Copy this folder into your repo as `design/pixel-kit/`.
2. `pip install pillow numpy`
3. Open Claude Code in the repo and paste the contents of `PROMPT.md`.

Claude Code will audit the app and write `design/DESIGN.md`, then stop for your approval before it changes any app code.

Quick self-test:

    python3 tools/sprite_build.py art/sprites --palette art/palette/yuki16.json --out art/build --preview 12
    python3 tools/pixel_lint.py sprite art/build --palette art/palette/yuki16.json
    python3 tools/pixel_lint.py contact art/build --out contact.png
    python3 tools/slop_lint.py ../../src        # point at your source folders

Known, intentional lint warnings in the reference art:
- shimaenaga W2 at (9,18) and (12,18): the feet joining the belly outline.
- shimaenaga sheet W1: the 1px closed eyes in the blink frame.
