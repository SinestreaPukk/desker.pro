// Usage: node design-audit/overflow.mjs [baseUrl]. No horizontal scroll at 360px on any page.
import { chromium } from 'playwright'
import { seed } from './seed.mjs'
const base = process.argv[2] || 'http://localhost:5173'
const browser = await chromium.launch(); let bad = 0
for (const profile of ['fresh', 'seeded']) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } })
  await ctx.route('**/api/state*', (r) => r.request().method() === 'GET' ? r.fulfill({ json: profile === 'seeded' ? seed() : {} }) : r.fulfill({ json: {} }))
  const p = await ctx.newPage()
  for (const pg of ['today', 'tasks', 'goals', 'projects', 'calendar']) {
    await p.goto(`${base}/${pg}`); await p.waitForLoadState('networkidle'); await p.waitForTimeout(300)
    const w = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth])
    if (w[0] > w[1]) { bad++; console.log(`${profile} /${pg}: scrollWidth ${w[0]} > ${w[1]}`) }
  }
  await ctx.close()
}
console.log(bad ? `${bad} pages overflow` : 'no horizontal scroll at 360px')
await browser.close()
