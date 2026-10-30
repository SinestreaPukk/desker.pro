import test from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL ||= 'postgres://u:p@localhost/db'
const { validate, validateRewrite, cleanRequest, twice } = await import('../api/_guide.js')
const { stepsFor, qaOf, fromAI, toSave, tagItems } = await import('../src/guide/questions.js')
const { toRows, fromRow } = await import('../api/_store.js')

const good = { vision: 'Live free', goals: [{ title: 'Save 50k', area: 'Finance', level: 'short', isHappiness: false, top: true, why: 'security', firstStep: 'Open account' }], letGo: ['Scrolling'], summary: 'ok' }

test('validate: accepts good output, rejects bad levels and shapes', () => {
  assert.equal(validate(good).goals[0].top, true)
  assert.throws(() => validate({ ...good, goals: [{ ...good.goals[0], level: 'vision' }] }))
  assert.throws(() => validate({ goals: [{ title: '', level: 'mid' }] }))
  assert.throws(() => validate(null))
  assert.deepEqual(validate({ goals: good.goals, vision: 'v' }).letGo, [])
})

test('twice: retries once on invalid output, then gives up', async () => {
  let n = 0
  assert.equal((await twice(async () => (++n === 1 ? { bad: 1 } : good), validate)).vision, 'Live free'); assert.equal(n, 2)
  n = 0
  await assert.rejects(twice(async () => { n++; return {} }, validate)); assert.equal(n, 2)
  assert.equal(validateRewrite({ title: ' x ' }).title, 'x')
})

test('cleanRequest bounds input', () => {
  assert.equal(cleanRequest({ areas: [], qa: [] }), null)
  assert.equal(cleanRequest({ areas: ['Finance'], qa: [{ q: 'q', a: '' }] }), null)
  assert.equal(cleanRequest({ areas: ['Finance'], qa: [{ q: 'q', a: 'a'.repeat(5000) }] }).qa[0].a.length, 1500)
})

test('qaOf renders every answer kind; skipped questions are left out', () => {
  const areas = ['Finance']
  const a = { q1: 'freedom', q2: '  ', q4: { Finance: 3 }, 'q7:Finance': 'rich', q10: ['a', '', 'c'], q11: { a: 'x', c: 'o' } }
  const qa = qaOf(stepsFor(areas), a, areas)
  assert.deepEqual(qa.map((x) => x.a), ['freedom', 'Finance: 3/10', 'rich', '1. a\n2. c', 'Excited: a\nObligation: c'])
  assert.deepEqual(tagItems(a, areas), ['a', 'c', 'rich'])
})

test('AI result -> app goals keeps area and flags; saving adds the vision at level 0', () => {
  const r = fromAI(validate(good), 1000)
  assert.deepEqual(r.goals[0], { id: 1000, title: 'Save 50k', level: 3, happiness: false, area: 'Finance', top: true, why: 'security', firstStep: 'Open account' })
  const saved = toSave(r, 5000)
  assert.deepEqual(saved.map((g) => g.level), [0, 3])
  assert.equal(toSave({ ...r, vision: ' ' }, 5000).length, 1)
})

test('goal area and guide fields survive the database mapping (via extra)', () => {
  const row = toRows({ goals: [{ id: 1, title: 'g', level: 3, area: 'Finance', top: true, firstStep: 'x' }] }).goals[0]
  assert.deepEqual(row.extra, { area: 'Finance', top: true, firstStep: 'x' })
  assert.equal(fromRow('goals', { ...row, id: 1 }).area, 'Finance')
})
