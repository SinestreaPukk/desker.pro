import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

// The palette lives in three places that must agree: pixel-kit/art/palette/yuki16.json (what the sprites are built from), the dark twin
// art/palette/yuki16-dark.json, and the tokens in src/index.css. This test fails if one is changed without the others, and checks WCAG AA for the pairs the UI really uses.
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const light = JSON.parse(read('pixel-kit/art/palette/yuki16.json')).colors
const dark = JSON.parse(read('art/palette/yuki16-dark.json')).colors
const scene = JSON.parse(read('art/palette/scene.json')).colors
const css = read('src/index.css')
const tokens = (block) => Object.fromEntries([...block.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(([, k, v]) => [k, v.toUpperCase()]))
const cssLight = tokens(css.slice(css.indexOf('@theme'), css.indexOf('--color-paper')))
const cssDark = tokens(css.slice(css.indexOf("html[data-theme='dark']"), css.indexOf('/* 4px from 640px up')))

const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

test('CSS tokens match the sprite palettes', () => {
  for (const [k, v] of Object.entries(light)) assert.equal(cssLight[k], v.toUpperCase(), `light ${k}`)
  for (const [k, v] of Object.entries(dark)) if (cssDark[k] !== undefined || ['yuki-0', 'yoru-2', 'kori-3'].includes(k)) assert.equal(cssDark[k], v.toUpperCase(), `dark ${k}`)
  for (const k of Object.keys(light)) assert.equal(scene[k]?.toUpperCase(), light[k].toUpperCase(), `scene ${k}`)
})

// [foreground, background, minimum ratio, what it is]. 4.5 for text, 3 for large text and UI outlines.
const PAIRS = [
  ['yoru-2', 'yuki-0', 4.5, 'body text on the page'], ['yoru-2', 'yuki-1', 4.5, 'body text on a panel'],
  ['yoru-1', 'yuki-0', 4.5, 'secondary text (slate-700)'], ['yoru-0', 'yuki-0', 4.5, 'captions (slate-600)'], ['yoru-0', 'yuki-1', 4.5, 'captions on a panel'],
  ['kori-3', 'yuki-0', 4.5, 'links and the active tab'], ['kori-3', 'yuki-1', 4.5, 'links on a panel'],
  ['yuki-0', 'kori-3', 4.5, 'primary button text'], ['LANTERN', 'ando-1', 4.5, 'text on the lantern tab'],
  ['beni', 'yuki-0', 4.5, 'danger text'], ['matsu-1', 'yuki-0', 4.5, 'positive text (leaf)'],
  ['yuki-3', 'yuki-0', 3, 'field and control outlines'],
]
for (const [name, pal] of [['light', light], ['dark', dark]]) {
  test(`${name} theme: text pairs meet WCAG AA`, () => {
    const bad = PAIRS.map(([f, b, min, what]) => [what, ratio(pal[f === 'LANTERN' ? (name === 'dark' ? 'yuki-0' : 'yoru-2') : f], pal[b]), min]).filter(([, r, min]) => r < min).map(([w, r, m]) => `${w}: ${r.toFixed(2)} < ${m}`)
    assert.deepEqual(bad, [])
  })
}
test('no component hard-codes a colour: only index.css and the palette files hold hex values', () => {
  const files = execSync("grep -rlE '#[0-9A-Fa-f]{6}\\b' src --include=*.jsx --include=*.js || true", { cwd: new URL('..', import.meta.url), encoding: 'utf8' }).split('\n').filter(Boolean)
  assert.deepEqual(files.filter((f) => f !== 'src/index.css' && !f.endsWith('city-scenes.json')), [])
})
