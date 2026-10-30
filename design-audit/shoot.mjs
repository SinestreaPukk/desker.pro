// Usage: node design-audit/shoot.mjs <before|after> [baseUrl]. Screenshots every page, fresh + seeded, 390 and 1440 wide.
import { chromium } from 'playwright'
import { seed } from './seed.mjs'
const [, , out = 'after', base = 'http://localhost:5173'] = process.argv
const pages = ['today', 'tasks', 'goals', 'projects', 'calendar']
const browser = await chromium.launch()
for (const profile of ['fresh', 'seeded']) {
  for (const [name, width, height] of [['390', 390, 844], ['1440', 1440, 900]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ...(width < 500 ? { isMobile: true, hasTouch: true } : {}) })
    await ctx.route('**/api/state*', (r) => r.request().method() === 'GET' ? r.fulfill({ json: profile === 'seeded' ? seed() : {} }) : r.fulfill({ json: { ok: true } }))
    await ctx.route('**/api/{ics,now,chat,prioritise,replan}*', (r) => r.fulfill({ status: 500, json: { error: 'offline in audit' } }))
    const p = await ctx.newPage()
    for (const pg of pages) {
      await p.goto(`${base}/${pg}`); await p.waitForLoadState('networkidle'); await p.waitForTimeout(500)
      await p.screenshot({ path: `design-audit/${out}/${profile}-${pg}-${name}.png`, fullPage: pg === 'today' })
    }
    await ctx.close()
  }
}
await browser.close()
