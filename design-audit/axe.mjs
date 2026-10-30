// Usage: node design-audit/axe.mjs [baseUrl]. axe-core on every page, fresh + seeded, 390 and 1440. Prints serious/critical violations.
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import { seed } from './seed.mjs'
const base = process.argv[2] || 'http://localhost:5173'
const browser = await chromium.launch(); let bad = 0
for (const profile of ['fresh', 'seeded']) for (const width of [390, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } })
  await ctx.route('**/api/state*', (r) => r.request().method() === 'GET' ? r.fulfill({ json: profile === 'seeded' ? seed() : {} }) : r.fulfill({ json: {} }))
  const p = await ctx.newPage()
  for (const pg of ['today', 'tasks', 'goals', 'projects', 'calendar']) {
    await p.goto(`${base}/${pg}`); await p.waitForLoadState('networkidle'); await p.waitForTimeout(400)
    const { violations } = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
    for (const v of violations.filter((v) => ['serious', 'critical'].includes(v.impact))) { bad++; console.log(`${profile} ${width} /${pg}: ${v.impact} ${v.id} (${v.nodes.length}) ${v.nodes[0].target.join(' ')} -- ${v.nodes[0].any[0]?.message || v.help}`) }
  }
  await ctx.close()
}
console.log(bad ? `${bad} serious/critical` : 'axe: zero serious/critical')
await browser.close()
