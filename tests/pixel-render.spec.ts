// Renders /today at three widths and two pixel ratios, then runs pixel_lint.py render on every piece of art:
// each art pixel must be a uniform block at its unit (--px = 2 css px, --px-scene = 4 at 1024+, else 2) and every colour must be in yuki16.
import { test, expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PALETTE = 'pixel-kit/art/palette/yuki16.json'
const LINT = 'pixel-kit/tools/pixel_lint.py'
const day = (n: number) => new Date(Date.now() + n * 864e5).toLocaleDateString('sv')
const state = {
  goals: [{ id: 1, title: 'Graduate with honours', level: 2 }], hobbies: [], projects: [], freeHours: 4,
  deadlines: [{ id: 1, title: 'Midterm', date: day(3), hours: 6 }],
  tasks: [{ id: 1, title: 'Finish lab report', due: day(1), important: true, urgent: true, hours: 2 }, { id: 2, title: 'Read chapter 4', due: day(5), important: true, urgent: false }],
}

function lint(png: string, scale: number) {
  try {
    execFileSync('python3', [LINT, 'render', png, '--scale', String(scale), '--palette', PALETTE, '--bg', '#F4F7F6'], { encoding: 'utf8' })
  } catch (e: any) {
    throw new Error(`${png} at scale ${scale}\n${e.stdout || e.message}`)
  }
}

async function open(page: Page, hour: number) {
  await page.addInitScript(() => { localStorage.guideSeen = '1' })
  await page.clock.setFixedTime(new Date(2026, 9, 30, hour, 0, 0))
  await page.route('**/api/state*', (r) => (r.request().method() === 'PUT' ? r.fulfill({ body: '{}' }) : r.fulfill({ json: state })))
  await page.goto('/today')
  await page.waitForSelector('.px-scene')
  await page.addStyleTag({ content: '.px-avatar{animation:none!important} .px-hanko{animation:none!important}' }) // freeze blinks so each shot is one frame
}

for (const width of [390, 768, 1440]) {
  for (const dpr of [1, 2]) {
    for (const [name, hour] of [['morning', 9], ['dusk', 15], ['night', 22]] as const) {
      if (name !== 'morning' && !(width === 1440 || (width === 390 && dpr === 2))) continue // variants: desktop 1x and phone 2x are enough
      test(`pixel art is crisp: ${width}px @${dpr}x, ${name}`, async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width, height: 2400 }, deviceScaleFactor: dpr })
        const page = await ctx.newPage()
        await open(page, hour)
        const dir = mkdtempSync(join(tmpdir(), 'px-'))
        const unit = 2 * dpr
        const sceneUnit = (width >= 1024 ? 4 : 2) * dpr

        await page.locator('.px-scene').screenshot({ path: join(dir, 'scene.png') })
        lint(join(dir, 'scene.png'), sceneUnit)

        const art: [string, number][] = [['.px-avatar:not(.px-avatar-scene)', unit], ['img[src*="/pixel/i-"]', unit]]
        for (const [i, [sel, scale]] of art.entries()) {
          const els = page.locator(sel)
          const n = Math.min(await els.count(), 6)
          expect(n, `${sel} present`).toBeGreaterThan(0)
          for (let k = 0; k < n; k++) {
            if (!(await els.nth(k).isVisible())) continue
            await els.nth(k).scrollIntoViewIfNeeded()
            const png = join(dir, `art${i}-${k}.png`)
            await els.nth(k).screenshot({ path: png })
            lint(png, scale)
          }
        }
        // frame edges: a strip across the 3-art-pixel border, no text inside it
        for (const sel of ['.px-btn-primary', '.px-panel', '.px-field']) {
          const el = page.locator(`${sel}:visible`).first()
          await el.scrollIntoViewIfNeeded()
          await page.evaluate(() => scrollTo(0, 0)) // clip coordinates are viewport-relative; keep the page still
          const box = await el.boundingBox()
          expect(box, `${sel} has a box`).not.toBeNull()
          const png = join(dir, `frame-${sel.slice(4)}.png`)
          await page.screenshot({ path: png, clip: { x: Math.round(box!.x), y: Math.round(box!.y), width: 6, height: Math.min(Math.round(box!.height), 60) } })
          lint(png, unit)
        }
        await ctx.close()
      })
    }
  }
}

test('reduced motion removes the snow and the blink', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.addInitScript(() => { localStorage.guideSeen = '1' })
  await page.route('**/api/state*', (r) => (r.request().method() === 'PUT' ? r.fulfill({ body: '{}' }) : r.fulfill({ json: state })))
  await page.goto('/today')
  await page.waitForSelector('.px-scene')
  const anim = await page.locator('.px-avatar-scene').evaluate((el) => getComputedStyle(el).animationName)
  expect(anim).toBe('none')
  const flakes = await page.locator('.px-flake').evaluateAll((cs: HTMLCanvasElement[]) => cs.some((c) => c.getContext('2d')!.getImageData(0, 0, 192, 80).data.some((v) => v !== 0)))
  expect(flakes, 'nothing is drawn').toBe(false)
  await ctx.close()
})
