// Usage: node design-audit/verify.mjs [baseUrl]. 5-second test, keyboard pass on Today, first-run tap count.
import { chromium } from 'playwright'
import { seed } from './seed.mjs'
const base = process.argv[2] || 'http://localhost:5173'
const browser = await chromium.launch()
const mk = async (profile, vp, extra = {}) => {
  const ctx = await browser.newContext({ viewport: vp, ...extra })
  await ctx.route('**/api/state*', (r) => r.request().method() === 'GET' ? r.fulfill({ json: profile === 'seeded' ? seed() : {} }) : r.fulfill({ json: {} }))
  return ctx
}

// 1. Five-second test: Do now title and Start are on screen, and not under the bottom tab bar.
for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
  const p = await (await mk('seeded', vp, { isMobile: true, hasTouch: true })).newPage()
  await p.goto(`${base}/today`); await p.waitForLoadState('networkidle'); await p.waitForTimeout(300)
  const start = await p.getByRole('button', { name: 'Start', exact: true }).first().boundingBox()
  const nav = await p.locator('nav[aria-label="Sections"]').last().boundingBox()
  console.log(`5-second ${vp.width}x${vp.height}: Start bottom ${Math.round(start.y + start.height)}px, tab bar top ${Math.round(nav.y)}px -> ${start.y + start.height <= nav.y ? 'PASS' : 'FAIL'}`)
}

// 2. Keyboard pass on Today (desktop): every control reachable, focus ring visible, Start works from the keyboard.
{
  const p = await (await mk('seeded', { width: 1440, height: 900 })).newPage()
  await p.goto(`${base}/today`); await p.waitForLoadState('networkidle'); await p.waitForTimeout(300)
  const total = await p.evaluate(() => [...document.querySelectorAll('a[href],button:not([disabled]),input:not([type=hidden]):not([disabled]),select,summary,textarea')].filter((e) => e.offsetParent && !e.classList.contains('sr-only') && !(e.closest('details:not([open])') && !e.matches('summary'))).length)
  const seen = new Set(); let noRing = [], unnamed = []
  for (let i = 0; i < total + 5; i++) {
    await p.keyboard.press('Tab')
    const f = await p.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return { id: `${e.tagName}|${e.getAttribute('aria-label') || e.textContent?.trim().slice(0, 30)}|${e.className}`, name: (e.getAttribute('aria-label') || e.textContent || e.labels?.[0]?.textContent || e.placeholder || '').trim(), ring: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 || s.boxShadow !== 'none' } })
    seen.add(f.id); if (!f.ring) noRing.push(f.id); if (!f.name) unnamed.push(f.id)
  }
  const all = await p.evaluate(() => [...document.querySelectorAll('a[href],button:not([disabled]),input:not([type=hidden]):not([disabled]),select,summary,textarea')].filter((e) => e.offsetParent && !e.classList.contains('sr-only') && !(e.closest('details:not([open])') && !e.matches('summary'))).map((e) => `${e.tagName}|${e.getAttribute('aria-label') || e.textContent?.trim().slice(0, 30)}|${e.className}`))
  const missed = all.filter((x) => !seen.has(x)); missed.slice(0, 12).forEach((x) => console.log('  not reached:', x))
  console.log(`keyboard: ${seen.size} focusable stops reached of ${total} controls; without visible focus ring: ${noRing.length}; without accessible name: ${unnamed.length}`)
  noRing.slice(0, 3).forEach((x) => console.log('  no ring:', x)); unnamed.slice(0, 3).forEach((x) => console.log('  unnamed:', x))
  await p.keyboard.press('Shift+Tab'); await p.locator('main').getByRole('button', { name: 'Start', exact: true }).first().focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(300)
  console.log('keyboard: Enter on Start ->', (await p.getByText('Stop', { exact: true }).count()) || (await p.getByRole('button', { name: /stop|done|pause/i }).count()) ? 'timer opened' : 'no response')
}

// 3. First run: fresh profile to first recommended task, counting taps. (Scripted, so it measures steps, not human time.)
{
  const p = await (await mk('fresh', { width: 390, height: 844 }, { isMobile: true, hasTouch: true })).newPage()
  let taps = 0; const t0 = Date.now()
  await p.goto(`${base}/today`); await p.waitForLoadState('networkidle')
  await p.getByRole('button', { name: 'Add tasks' }).tap(); taps++
  await p.getByPlaceholder(/What needs doing/).fill('Study for Cell Bio midterm'); taps++ // focus + type
  await p.waitForTimeout(400); await p.getByRole('button', { name: 'Add', exact: true }).tap(); taps++
  await p.locator('nav[aria-label="Sections"]').last().getByRole('button', { name: 'Today' }).tap(); taps++
  await p.getByRole('heading', { name: 'Do now' }).waitFor()
  const shown = await p.getByText('Study for Cell Bio midterm').first().isVisible()
  console.log(`first run: first recommended task visible=${shown} after ${taps} actions (tap Add tasks, tap field + type, tap Add, tap Today); scripted wall time ${((Date.now() - t0) / 1000).toFixed(1)}s`)
}
await browser.close()
