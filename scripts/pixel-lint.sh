#!/bin/sh
# Art rules (palette, colour budgets, outlines) and the CSS/copy slop lint. Exits non-zero on any error.
set -e
P=pixel-kit/art/palette/yuki16.json
L="python3 pixel-kit/tools/pixel_lint.py"
$L sprite public/pixel/i-*.png --palette $P --max-colors 4
$L sprite public/pixel/av-*.png --palette $P --max-colors 12
$L sprite public/pixel/kodama*.png --palette art/palette/kodama.json --max-colors 9 --grid 8
$L sprite public/pixel/btn-*.png public/pixel/tab-*.png public/pixel/panel*.png public/pixel/field.png public/pixel/check*.png public/pixel/hanko*.png --palette $P --max-colors 12
$L sprite public/pixel/divider.png public/pixel/backdrop.png --palette $P --max-colors 2 --grid 1
$L sprite public/pixel/scene-*.png --palette $P --max-colors 16 --grid 16
python3 pixel-kit/tools/slop_lint.py src
