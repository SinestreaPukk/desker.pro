import test from 'node:test'
import assert from 'node:assert/strict'
import { schedule, overlaps, planWeek, repair, busyDays } from '../src/schedule.js'

const NOW = new Date('2026-10-31T09:00:00') // a Saturday, local time
const at = (date, h, m = 0) => new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime()
const task = (id, o = {}) => ({ id, title: `T${id}`, hours: 1, ...o })
const mins = (s) => +s.slice(0, 2) * 60 + +s.slice(3)
// no two plan items on one day may overlap
const clean = (plan, tasks) => {
  const len = (id) => (tasks.find((t) => t.id === id).hours || 1) * 60
  for (const a of plan) for (const b of plan) if (a.id < b.id && a.when === b.when) assert.ok(mins(a.start) + len(a.id) <= mins(b.start) || mins(b.start) + len(b.id) <= mins(a.start), `overlap ${a.id}/${b.id}`)
}

test('two tasks the AI put at 20:00 on the same day are pulled apart', () => {
  const tasks = [task(1, { hours: 2, due: '2026-11-01' }), task(2, { hours: 1, due: '2026-11-01' })]
  const aiPlan = [{ id: 1, when: '2026-10-31', start: '20:00' }, { id: 2, when: '2026-10-31', start: '20:00' }]
  const { plan, problems } = planWeek({ tasks, busy: [], deadlines: [], freeHours: 4, aiPlan, now: NOW })
  assert.equal(plan.length, 2); assert.equal(problems.length, 0)
  clean(plan, tasks)
  assert.ok(plan.some((p) => p.when === '2026-10-31' && p.start === '20:00')) // the first proposal is kept where valid
})

test('free time cap: 4h a day holds 3h+1h, the next task moves to the next day', () => {
  const tasks = [task(1, { hours: 3, due: '2026-11-05' }), task(2, { hours: 1, due: '2026-11-05' }), task(3, { hours: 2, due: '2026-11-05' })]
  const { plan } = schedule({ tasks, freeHours: 4, now: NOW })
  const per = {}; plan.forEach((p) => { per[p.when] = (per[p.when] || 0) + tasks.find((t) => t.id === p.id).hours })
  assert.ok(Object.values(per).every((h) => h <= 4), JSON.stringify(per))
  clean(plan, tasks)
})

test("today's free time overrides the daily number", () => {
  const tasks = [task(1, { hours: 2, due: '2026-11-03' })]
  const { plan } = schedule({ tasks, freeHours: 4, freeToday: 1, now: NOW })
  assert.notEqual(plan[0].when, '2026-10-31') // 2h does not fit in 1h of free time today
  const ok = schedule({ tasks, freeHours: 4, freeToday: 3, now: NOW })
  assert.equal(ok.plan[0].when, '2026-10-31')
})

test('a deadline that cannot be met is reported, never silently overlapped', () => {
  // due tomorrow with 1h free a day: 3h cannot fit in 2 days
  const tasks = [task(1, { hours: 1, due: '2026-10-31' }), task(2, { hours: 1, due: '2026-10-31' })]
  const { plan, problems } = schedule({ tasks, freeHours: 1, now: NOW })
  assert.equal(problems.length, 1)
  assert.match(problems[0].why, /Can't fit .* before its deadline: 1h short/)
  assert.equal(plan.length, 2) // still given a free slot, after the deadline
  assert.ok(plan.find((p) => p.late).when > '2026-10-31')
  clean(plan, tasks)
})

test('a deadline with a time ends the task before that time', () => {
  const deadlines = [{ id: 9, title: 'Quiz', date: '2026-10-31', time: '12:00' }]
  const ok = schedule({ tasks: [task(1, { hours: 2, deadlineId: 9, due: '2026-10-31' })], deadlines, freeHours: 4, now: NOW })
  assert.equal(ok.problems.length, 0); assert.ok(mins(ok.plan[0].start) + 120 <= 12 * 60)
  const bad = schedule({ tasks: [task(1, { hours: 4, deadlineId: 9, due: '2026-10-31' })], deadlines, freeHours: 6, now: NOW }) // 09:00-12:00 is only 3h
  assert.equal(bad.problems.length, 1)
})

test('imported calendar events block time; all-day events do not', () => {
  const busy = [{ t: 'Lecture', s: at('2026-10-31', 9), e: at('2026-10-31', 12) }, { t: 'Birthday', d: '2026-10-31' }]
  const { plan } = schedule({ tasks: [task(1, { hours: 1, due: '2026-10-31' })], busy, freeHours: 4, now: NOW })
  assert.equal(plan[0].start, '12:00')
  const prefer = { 1: { when: '2026-10-31', start: '10:00' } } // the AI proposes a time inside the lecture
  const moved = schedule({ tasks: [task(1, { due: '2026-10-31' })], busy, prefer, freeHours: 4, now: NOW })
  assert.equal(moved.plan[0].start, '12:00')
})

test('an event that runs past midnight blocks the next morning too', () => {
  const m = busyDays([{ t: 'Night shift', s: at('2026-10-31', 22), e: at('2026-11-01', 8) }])
  assert.deepEqual(m.get('2026-10-31'), [{ s: 1320, e: 1440, title: 'Night shift' }])
  assert.deepEqual(m.get('2026-11-01'), [{ s: 0, e: 480, title: 'Night shift' }])
})

test('tasks with no duration get a 1h block and are flagged as assumed', () => {
  const { plan } = schedule({ tasks: [{ id: 1, title: 'Tidy' }, { id: 2, title: 'Email' }], freeHours: 4, now: NOW })
  assert.ok(plan.every((p) => p.assumed)); clean(plan, [{ id: 1 }, { id: 2 }])
})

test('nothing starts in the past today or outside the day window', () => {
  const late = new Date('2026-10-31T22:10:00')
  const { plan } = schedule({ tasks: [task(1, { hours: 2 })], freeHours: 4, now: late })
  assert.equal(plan[0].when, '2026-11-01'); assert.equal(plan[0].start, '07:00')
  const early = schedule({ tasks: [task(1)], freeHours: 4, now: new Date('2026-10-31T03:00:00') })
  assert.equal(early.plan[0].start, '07:00')
})

test('a task longer than a day of free time is reported with advice to split it', () => {
  const { plan, problems } = schedule({ tasks: [task(1, { hours: 6, due: '2026-11-05' })], freeHours: 4, now: NOW })
  assert.equal(plan.length, 0); assert.match(problems[0].why, /Split it/)
})

test('fixed planned tasks block time and use free hours', () => {
  const fixed = [task(5, { when: '2026-10-31', start: '09:00', hours: 3, done: false })]
  const { plan } = schedule({ tasks: [task(1, { hours: 1, due: '2026-10-31' })], fixed, freeHours: 4, now: NOW })
  assert.equal(plan[0].start, '12:00')
  const full = schedule({ tasks: [task(1, { hours: 2, due: '2026-10-31' })], fixed, freeHours: 4, now: NOW }) // 3h used of 4h
  assert.equal(full.problems.length, 1)
})

test('overlaps finds the saved double-booking and task-vs-event clashes', () => {
  const tasks = [task(1, { when: '2026-10-31', start: '20:00', hours: 2 }), task(2, { when: '2026-10-31', start: '20:00', hours: 1 }), task(3, { when: '2026-10-31', start: '22:00', hours: 1 }), task(4, { when: '2026-10-31', start: '14:30', hours: 1 })]
  const busy = [{ t: 'Gym', s: at('2026-10-31', 14), e: at('2026-10-31', 15) }]
  const o = overlaps(tasks, busy)
  assert.equal(o.length, 2)
  assert.deepEqual(o.map((x) => [x.a.id, x.b.id ?? x.b.title]).sort(), [[1, 2], [4, 'Gym']].sort())
  assert.equal(overlaps([tasks[0], tasks[2]], []).length, 0) // 20-22 then 22-23 touch but do not overlap
})

test('repair keeps a valid agent slot and fixes an invalid one, leaving other tasks alone', () => {
  const tasks = [task(1, { when: '2026-10-31', start: '10:00', hours: 1 }), task(2, { when: '2026-10-31', start: '10:30', hours: 1, due: '2026-11-02' }), task(3, { when: '2026-10-31', start: '15:00', hours: 1 })]
  const r = repair({ tasks, changed: [2], busy: [], deadlines: [], freeHours: 4, now: NOW })
  assert.deepEqual([r.tasks[0].start, r.tasks[2].start], ['10:00', '15:00']) // untouched
  assert.notEqual(r.tasks[1].start, '10:30'); assert.equal(overlaps(r.tasks).length, 0)
})

test('without an AI plan, slots that are already valid are kept and only the clash moves', () => {
  const tasks = [task(1, { when: '2026-10-31', start: '13:00', hours: 1.5, due: '2026-11-05' }), task(2, { when: '2026-10-31', start: '20:00', hours: 2, due: '2026-11-01' }), task(3, { when: '2026-10-31', start: '20:00', hours: 1, due: '2026-11-02' })]
  const { plan } = planWeek({ tasks, busy: [], deadlines: [], freeHours: 6, now: NOW })
  const at = (id) => plan.find((p) => p.id === id)
  assert.equal(at(1).start, '13:00'); assert.equal(at(2).start, '20:00'); assert.notEqual(at(3).start, '20:00')
  clean(plan, tasks)
})
