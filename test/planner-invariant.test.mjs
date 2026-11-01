import test from 'node:test'
import assert from 'node:assert/strict'
import { planWeek, repair, settleOverlaps, moveOther, overlaps, slotLength } from '../src/schedule.js'

// Seeded random so a failure can be replayed.
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const NOW = new Date('2026-11-02T08:00:00')
const day = (n) => { const d = new Date(NOW); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv') }
const clashesOf = (tasks, busy, scale, pad) => overlaps(tasks, busy, scale, pad)

function world(seed) {
  const r = rng(seed), pick = (a) => a[Math.floor(r() * a.length)]
  const scale = pick([1, 1.13, 1.3, 1.6, 2]), pad = pick([0, 15, 30])
  const tasks = Array.from({ length: 2 + Math.floor(r() * 10) }, (_, i) => ({
    id: i + 1, title: `Task ${i + 1}`, hours: pick([0.25, 0.5, 1, 1.5, 2, 3, undefined]), done: false,
    ...(r() < 0.5 && { due: day(Math.floor(r() * 6)) }), important: r() < 0.5,
  }))
  const busy = Array.from({ length: Math.floor(r() * 8) }, () => {
    const s = new Date(`${day(Math.floor(r() * 5))}T00:00:00`).getTime() + (7 + Math.floor(r() * 14)) * 36e5
    return { t: 'Class', s, e: s + pick([1, 1.5, 2, 3]) * 36e5 }
  })
  return { r, scale, pad, tasks, busy, freeHours: pick([3, 5, 8]) }
}

test('after any planner run, no two planned items overlap, events included (500 random worlds)', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const w = world(seed)
    const { plan } = planWeek({ tasks: w.tasks, busy: w.busy, deadlines: [], freeHours: w.freeHours, scale: w.scale, pad: w.pad, now: NOW })
    const placed = w.tasks.map((t) => { const p = plan.find((x) => x.id === t.id); return p ? { ...t, when: p.when, start: p.start } : t })
    assert.deepEqual(clashesOf(placed, w.busy, w.scale, w.pad), [], `seed ${seed}`)
  }
})

test('a changed multiplier cannot leave an overlap: settleOverlaps re-places the day (500 random worlds)', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const w = world(seed + 1000)
    const { plan } = planWeek({ tasks: w.tasks, busy: w.busy, deadlines: [], freeHours: w.freeHours, scale: 1, pad: 0, now: NOW })
    const placed = w.tasks.map((t) => { const p = plan.find((x) => x.id === t.id); return p ? { ...t, when: p.when, start: p.start } : t })
    const scale = 1 + w.r(), pad = w.r() < 0.5 ? 15 : 0 // durations grow after placement
    const out = settleOverlaps({ tasks: placed, busy: w.busy, deadlines: [], freeHours: 24, scale, pad, now: NOW })
    const left = clashesOf(out.tasks, w.busy, scale, pad).filter(({ a, b }) => !(a.pinned && b.pinned))
    // a task longer than a whole day of free time is reported as a problem and left where it was, which is the only way one can remain
    const tooLong = new Set(out.problems.map((p) => p.id))
    assert.deepEqual(left.filter(({ a, b }) => !tooLong.has(a.id) && !tooLong.has(b.id)), [], `seed ${seed}`)
  }
})

test('hand-set times are pinned: the planner leaves them, and an overlap the user makes is allowed', () => {
  const tasks = [
    { id: 1, title: 'A', hours: 1, when: '2026-11-02', start: '10:00', pinned: true },
    { id: 2, title: 'B', hours: 1, when: '2026-11-02', start: '10:30', pinned: true },
    { id: 3, title: 'C', hours: 1, when: '2026-11-02', start: '10:15' },
  ]
  const out = settleOverlaps({ tasks, freeHours: 8, scale: 1, pad: 0, now: NOW })
  assert.deepEqual(out.tasks.filter((t) => t.pinned).map((t) => t.start), ['10:00', '10:30']) // pinned stay
  const left = clashesOf(out.tasks, [], 1, 0)
  assert.ok(left.length > 0 && left.every(({ a, b }) => a.pinned && b.pinned)) // only the user's own overlap remains
  assert.notEqual(out.tasks.find((t) => t.id === 3).start, '10:15') // the unpinned one moved
})

test('"Move the other one" resolves a pinned overlap', () => {
  const tasks = [
    { id: 1, title: 'A', hours: 1, when: '2026-11-02', start: '10:00', pinned: true },
    { id: 2, title: 'B', hours: 1, when: '2026-11-02', start: '10:30', pinned: true },
  ]
  const [{ a, b }] = overlaps(tasks, [], 1, 0)
  const out = moveOther({ tasks, freeHours: 8, scale: 1, pad: 0, now: NOW }, a, b)
  assert.deepEqual(overlaps(out.tasks, [], 1, 0), [])
})

test('the reported case: 1h30 at 20:45 and 2h45 at 21:00 cannot both be planned', () => {
  const tasks = [{ id: 1, title: 'Review notes', hours: 1, due: '2026-11-02' }, { id: 2, title: 'Work practice problems', hours: 2, due: '2026-11-02' }]
  const { plan } = planWeek({ tasks, deadlines: [], freeHours: 8, scale: 1.3, pad: 15, now: new Date('2026-11-02T20:00:00') })
  const placed = tasks.map((t) => ({ ...t, ...plan.find((p) => p.id === t.id) }))
  assert.deepEqual(clashesOf(placed, [], 1.3, 15), [])
  assert.equal(slotLength(tasks[0], 1.3, 15), 95)
})

test('a task that cannot make its deadline says so in plain words', () => {
  const tasks = [{ id: 1, title: 'Static quiz prep', hours: 3, due: '2026-11-02' }]
  const busy = [{ t: 'Exam', s: new Date('2026-11-02T08:00:00').getTime(), e: new Date('2026-11-02T23:00:00').getTime() }] // the whole day is taken
  const { problems } = planWeek({ tasks, busy, deadlines: [], freeHours: 8, scale: 1, pad: 0, now: NOW })
  assert.match(problems[0].why, /Static quiz prep doesn't fit before Mon.*Want to free up time\?/)
})
