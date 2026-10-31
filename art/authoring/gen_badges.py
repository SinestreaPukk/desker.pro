#!/usr/bin/env python3
"""Pixel art for the kodama dialog: 8 badge medals + a locked one, 5 growth-stage plants, flame/ember (streak), quest on/off, three small stat icons.
Writes art/sprites/{b,s,g}-*.sprite.txt (16x16), which `npm run pixel:build` turns into PNGs. Run: python3 art/authoring/gen_badges.py
The medals have a light rim and a dark outline, so they read on both the light and the dark panel; the dialog always uses the light-theme PNGs."""
import pathlib, math
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / 'art/sprites'
KEY = {'.': 'transparent', 'W': 'yuki-0', 'K': 'yoru-2', 'a': 'matsu-0', 'b': 'matsu-1', 'c': 'matsu-2', 'd': 'kori-1', 'e': 'kori-2', 'f': 'kori-3',
       'g': 'ando-0', 'h': 'ando-1', 'i': 'ando-2', 'j': 'beni', 'k': 'hada-0', 'l': 'hada-1', 'm': 'kuri', 'n': 'yuki-2', 'o': 'yuki-3', 'p': 'yoru-0', 'q': 'yoru-1'}

def write(name, rows, note):
    assert len(rows) == 16 and all(len(r) == 16 for r in rows), (name, [len(r) for r in rows])
    used = sorted({ch for r in rows for ch in r} | {'.'})
    head = f'# {note}\nsize 16 16\npalette yuki16\n' + ''.join(f'{ch} {KEY[ch]}\n' for ch in used) + 'frame rest\n'
    (OUT / f'{name}.sprite.txt').write_text(head + '\n'.join(rows) + '\n'); print('wrote', name)

GLYPH = {
 'check': ['........', '.......#', '......##', '#....##.', '##..##..', '.####...', '..##....', '........'],
 'star': ['...##...', '...##...', '########', '.######.', '..####..', '.######.', '.##..##.', '........'],
 'trophy': ['########', '#.####.#', '#.####.#', '.######.', '..####..', '...##...', '..####..', '.######.'],
 'flame': ['....#...', '...##...', '..###...', '.####...', '.#####..', '.#####..', '.#####..', '..###...'],
 'flames': ['..#..#..', '..##.##.', '.######.', '.######.', '.######.', '.#####..', '..###...', '........'],
 'flag': ['.#......', '.####...', '.#####..', '.####...', '.#......', '.#......', '.#......', '###.....'],
 'compass': ['...##...', '..####..', '.##..##.', '##.##.##', '##.##.##', '.##..##.', '..####..', '...##...'],
 'hourglass': ['########', '.#....#.', '..#..#..', '...##...', '...##...', '..#..#..', '.######.', '########'],
 'lock': ['..####..', '.#....#.', '.#....#.', '########', '########', '###..###', '########', '########'],
 'bolt': ['....##..', '...##...', '..##....', '.######.', '....##..', '...##...', '..##....', '..#.....'],
 'moon': ['..####..', '.##.....', '##......', '##......', '##......', '.##.....', '..####..', '........'],
}

def medal(name, fill, glyph, gcol, note, rim='W'):
    mid, shade, hi = fill
    g = [[rim if False else '.' for _ in range(16)] for _ in range(16)]
    for y in range(16):
        for x in range(16):
            d = math.hypot(x - 7.5, y - 7.5)
            if d <= 7.7: g[y][x] = 'W'
            if d <= 6.7: g[y][x] = 'K'
            if d <= 5.7: g[y][x] = mid
            if d <= 5.7 and x + y >= 17: g[y][x] = shade          # lower-right shade
            if d <= 5.7 and x + y <= 9 and d > 3.5: g[y][x] = hi   # upper-left shine
    for y, r in enumerate(GLYPH[glyph]):
        for x, ch in enumerate(r):
            if ch == '#': g[4 + y][4 + x] = gcol
    write(name, [''.join(r) for r in g], note)

# name, (mid, shade, hi), glyph, glyph colour
medal('b-first', ('l', 'm', 'k'), 'check', 'K', 'Badge: First step (bronze).')
medal('b-ten', ('e', 'f', 'd'), 'star', 'W', 'Badge: Ten down (blue).')
medal('b-fifty', ('h', 'i', 'g'), 'trophy', 'K', 'Badge: Fifty down (gold).')
medal('b-streak3', ('j', 'm', 'l'), 'flame', 'g', 'Badge: On a roll (red).')
medal('b-streak7', ('j', 'm', 'l'), 'flames', 'g', 'Badge: Week warrior (red).')
medal('b-milestone', ('a', 'b', 'd'), 'flag', 'W', 'Badge: Milestone maker (green).')
medal('b-guide', ('e', 'f', 'd'), 'compass', 'g', 'Badge: Pathfinder (blue).')
medal('b-focus', ('p', 'q', 'o'), 'hourglass', 'g', 'Badge: Deep focus (navy).')
medal('b-locked', ('n', 'o', 'W'), 'lock', 'p', 'A badge you have not earned yet.')

STAGES = {
 's-0': ['................', '................', '................', '................', '................', '................', '.......a........', '......aba.......', '.....ab.ba......', '.......b........', '.......b........', '....mmmmmmmm....', '...mmmmmmmmmm...', '..mmmmmmmmmmmm..', '................', '................'],
 's-1': ['................', '................', '................', '....aa....aa....', '...abba..abba...', '...abbbaabbba...', '....abbbbbba....', '.....abbbba.....', '.......bb.......', '.......bb.......', '.......bb.......', '....mmmmmmmm....', '...mmmmmmmmmm...', '..mmmmmmmmmmmm..', '................', '................'],
 's-2': ['................', '......aaaa......', '....aabbbbaa....', '...abbbbbbbba...', '...abbcbbcbba...', '...abbbbbbbba...', '....aabbbbaa....', '......aabb......', '.......mm.......', '.......mm.......', '.......mm.......', '....mmmmmmmm....', '...mmmmmmmmmm...', '..mmmmmmmmmmmm..', '................', '................'],
 's-3': ['......aaaa......', '....aabbbbaa....', '...abbbbbbbba...', '..abbbcbbcbbba..', '..abbbbbbbbbba..', '..abbcbbbbcbba..', '...abbbbbbbba...', '....aabbbbaa....', '......mmmm......', '......mmmm......', '.......mm.......', '....mmmmmmmm....', '...mmmmmmmmmm...', '..mmmmmmmmmmmm..', '................', '................'],
 's-4': ['....aaaaaaaa....', '..aabbbbbbbbaa..', '.abbbbcbbcbbbba.', '.abbcbbbbbbcbba.', 'abbbbbbhbbbbbbba', 'abbcbbbhgbbbcbba', '.abbbbbhhbbbbba.', '.aabbbbbmbbbbaa.', '...aabbbmbbaa...', '......mmmm......', '......mmmm......', '.....mmmmmm.....', '....mmmmmmmm....', '...mmmmmmmmmm...', '................', '................'],
}
for n, r in STAGES.items(): write(n, r, f'Kodama growth stage {n[-1]}.')

def scale2(glyph):
    return [''.join(c * 2 for c in row) for row in GLYPH[glyph] for _ in range(2)]
def erode(m):
    return [[m[y][x] and all(0 <= y + dy < 16 and 0 <= x + dx < 16 and m[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) for x in range(16)] for y in range(16)]
def layered(glyph, cols):
    m = [[ch == '#' for ch in row] for row in scale2(glyph)]
    levels = [m]
    for _ in range(len(cols) - 1): levels.append(erode(levels[-1]))
    return [''.join(next((cols[i] for i in range(len(cols) - 1, -1, -1) if levels[i][y][x]), '.') for x in range(16)) for y in range(16)]
write('g-flame', layered('flame', ['j', 'h', 'g']), 'A lit day in the streak.')
write('g-ember', ['................'] * 12 + ['.....oo....oo...', '.....oo....oo...', '................', '................'], 'A day without a streak flame.')
write('g-bolt', layered('bolt', ['i', 'h']), 'Energy checks.')
write('g-moon', layered('moon', ['e', 'd']), 'Wrap-ups.')
write('g-hourglass', layered('hourglass', ['m', 'l']), 'Hours with the timer.')

def ring(on):
    g = [['.'] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            d = math.hypot(x - 7.5, y - 7.5)
            if d <= 7.3: g[y][x] = 'b' if on else 'o'
            if d <= 5.8: g[y][x] = 'a' if on else '.'
    if on:
        for y, r in enumerate(GLYPH['check']):
            for x, ch in enumerate(r):
                if ch == '#': g[4 + y][4 + x] = 'k'
    return [''.join(r) for r in g]
write('g-quest-on', ring(True), 'A task done towards the daily quest.')
write('g-quest-off', ring(False), 'A task still to do for the daily quest.')
