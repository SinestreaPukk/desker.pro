#!/usr/bin/env python3
"""Static lint for the pixel theme: catches non-pixel CSS and generic 'AI slop' tells.

Scans .css .scss .ts .tsx .js .jsx .html .vue .svelte .mdx under the given paths.
Suppress a single line only with a reason:   /* pixel-ok: <why> */  or  // pixel-ok: <why>
A bare 'pixel-ok' with no reason does not count.

ERROR (exit 1)                                   WARN (review, fix or justify)
- gradients (CSS or Tailwind)                    - non-stepped transitions/easing on UI motion
- blurred shadows / blur / backdrop-blur         - fractional px values
- border-radius / rounded-* (except none)        - font sizes off the pixel-font grid (12/16 multiples)
- smooth image scaling missing globally          - rotate() not a multiple of 90deg, non-integer scale()
- template colours: #F4F1EA #D97757 #0B0B0B #111  - copy tells: '→' in UI text, emoji, sparkles,
- generic fonts as the primary family              'Unlock/Supercharge/Seamless/Elevate/Effortless',
                                                    middle-dot meta strings, uppercase+tracking eyebrows

Usage: python3 slop_lint.py src/ app/ components/ [--exclude node_modules,.next,dist]
"""
import argparse, pathlib, re, sys

EXT = {'.css', '.scss', '.ts', '.tsx', '.js', '.jsx', '.html', '.vue', '.svelte', '.mdx'}

ERRORS = [
    ('gradient', re.compile(r'(linear|radial|conic|repeating-linear|repeating-radial)-gradient\(|\bbg-(gradient|linear|radial|conic)-to?-?\w*|\b(from|via|to)-(purple|violet|indigo|fuchsia|pink)-\d+')),
    ('blurred shadow/blur', re.compile(r'\b(shadow|shadow-(sm|md|lg|xl|2xl|inner))(?=[\s"\'`}])|\bdrop-shadow(-\w+)?\b|\b(backdrop-)?blur(-\w+)?\b|backdrop-filter\s*:|filter\s*:\s*[^;]*blur\(|box-shadow\s*:(?:[^;]*,)?\s*(?:inset\s+)?-?\d*\.?\d+(?:px|rem|em)?\s+-?\d*\.?\d+(?:px|rem|em)?\s+(?!0(?:px)?[\s,;])\d*\.?\d+(?:px|rem|em)')),
    ('rounded corners', re.compile(r'border(-[a-z-]+)?-radius\s*:(?!\s*(0(px)?\s*[;!}"\']|none))|\brounded(-(?!none\b)[a-z0-9\[\]./-]+)?(?=[\s"\'`}])')),
    ('template colour', re.compile(r'#(F4F1EA|D97757|0B0B0B|111111|111)\b', re.I)),
    ('generic primary font', re.compile(r'font-family\s*:\s*["\']?(Inter|Roboto|Poppins|Space Grotesk|Press Start 2P|Montserrat|Open Sans)\b|\bfont-(inter|roboto|poppins)\b', re.I)),
]
WARNS = [
    ('smooth easing (use steps())', re.compile(r'transition[^;\n]*\b(ease|ease-in|ease-out|ease-in-out|cubic-bezier\([^)]*\))|animation[^;\n]*\b(ease|cubic-bezier)|\b(ease-(in|out|in-out|linear))\b|\btransition-(all|colors|transform|opacity)\b')),
    ('fractional px', re.compile(r'(?<![\d.])\d+\.\d+px')),
    ('font size off pixel grid', re.compile(r'\btext-(sm|lg|xl|3xl|6xl|7xl)\b|font-size\s*:\s*(1[0135789]|2[1235679]|3[01345789]|1[4]|2[2])px|\btext-\[(1[0135789]|2[1235679]|1[4]|2[2])px\]')),
    ('rotation/scale breaks the grid', re.compile(r'rotate\(\s*(?!(0|90|180|270|-90)deg)[-\d.]+deg|\brotate-(?!0\b|90\b|180\b)\d+\b|scale\(\s*(?!1\b|2\b|3\b|4\b)\d*\.\d+')),
    ('copy tell: arrow in UI text', re.compile(r'[>"\'\s]\s*[^<>{}\n]*\S\s*→\s*[<"\']')),
    ('copy tell: emoji/sparkles', re.compile('[✨\U0001F300-\U0001FAFF☀-⛿⭐]')),
    ('copy tell: hype words', re.compile(r'\b(Unlock|Supercharge|Seamless(ly)?|Elevate|Effortless(ly)?|Revolutioni[sz]e|Empower|Next-gen|AI-powered|Game-?changer)\b')),
    ('copy tell: middle-dot meta', re.compile(r'\S\s·\s\S')),
    ('eyebrow: uppercase + tracking', re.compile(r'\buppercase\b[^"\'`]*\btracking-(wide|wider|widest)|\btracking-(wide|wider|widest)\b[^"\'`]*\buppercase\b')),
]
SUPPRESS = re.compile(r'pixel-ok:\s*\S{3,}')


def scan(paths, exclude):
    findings, pixelated_seen, files = [], False, 0
    for root in map(pathlib.Path, paths):
        it = [root] if root.is_file() else root.rglob('*')
        for f in it:
            if f.suffix not in EXT or any(part in exclude for part in f.parts):
                continue
            files += 1
            try:
                text = f.read_text(encoding='utf-8')
            except UnicodeDecodeError:
                continue
            if re.search(r'image-rendering\s*:\s*(pixelated|crisp-edges)|\[image-rendering:pixelated\]|\brendering-pixelated\b', text):
                pixelated_seen = True
            for n, line in enumerate(text.splitlines(), 1):
                if SUPPRESS.search(line):
                    continue
                for sev, rules in (('ERROR', ERRORS), ('WARN', WARNS)):
                    for name, rx in rules:
                        m = rx.search(line)
                        if m:
                            findings.append((sev, name, f, n, line.strip()[:120]))
    return findings, pixelated_seen, files


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('paths', nargs='+')
    ap.add_argument('--exclude', default='node_modules,.next,dist,build,.git,coverage,.vercel')
    a = ap.parse_args()
    findings, pix, files = scan(a.paths, set(a.exclude.split(',')))
    if not pix:
        findings.append(('ERROR', 'no global image-rendering: pixelated', pathlib.Path(a.paths[0]), 0, 'add it to the art/sprite base class'))
    for sev, name, f, n, line in sorted(findings, key=lambda x: (x[0] != 'ERROR', str(x[2]), x[3])):
        print(f'{sev:5} {f}:{n}  [{name}]  {line}')
    e = sum(1 for x in findings if x[0] == 'ERROR'); w = len(findings) - e
    print(f'\n{files} files scanned — {e} error(s), {w} warning(s)')
    sys.exit(1 if e else 0)


if __name__ == '__main__':
    main()
