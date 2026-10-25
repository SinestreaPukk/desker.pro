import test from 'node:test'
import assert from 'node:assert/strict'
import { nextDate, settle, doneStats } from '../src/tasks.js'
import { dueReminders } from '../src/reminders.js'
import { lanes } from '../src/layout.js'

test('nextDate: daily, weekdays, weekly, monthly clamp, late finish', () => {
  assert.equal(nextDate('2026-10-24', 'daily', '2026-10-25'), '2026-10-26')
  assert.equal(nextDate('2026-10-23', 'weekdays', '2026-10-23'), '2026-10-26') // Fri -> Mon
  assert.equal(nextDate('2026-10-23', 'weekly', '2026-10-23'), '2026-10-30')
  assert.equal(nextDate('2026-01-31', 'monthly', '2026-01-31'), '2026-02-28')
  assert.equal(nextDate('2026-01-31', 'monthly', '2026-03-01'), '2026-03-31') // keeps the 31st after clamping
  assert.equal(nextDate('2026-10-01', 'daily', '2026-10-25'), '2026-10-26') // done weeks late
})

test('settle stamps doneAt, spawns repeats, and reopening clears doneAt', () => {
  const now = new Date('2026-10-25T10:00:00').getTime()
  const prev = [{ id: 1, title: 'gym', done: false, repeat: 'daily', due: '2026-10-25', subs: [{ id: 1, title: 'x', done: true }] }, { id: 2, title: 'once', done: false }]
  const r = settle(prev, prev.map((t) => ({ ...t, done: true })), now)
  assert.equal(r.tasks.length, 3)
  assert.equal(r.tasks[0].doneAt, now)
  const copy = r.tasks[2]
  assert.deepEqual([copy.done, copy.due, copy.subs[0].done, copy.doneAt], [false, '2026-10-26', false, undefined])
  assert.deepEqual(r.spawned, [copy.id])
  const back = settle(r.tasks, r.tasks.map((t) => (t.id === 2 ? { ...t, done: false } : t)), now)
  assert.equal(back.tasks.find((t) => t.id === 2).doneAt, undefined)
  assert.equal(back.tasks.length, 3)
})

test('doneStats counts this week and the streak', () => {
  const now = new Date('2026-10-25T10:00:00').getTime() // a Sunday
  const d = (s) => new Date(s).getTime()
  const tasks = [
    { done: true, doneAt: d('2026-10-25T08:00:00') }, { done: true, doneAt: d('2026-10-24T08:00:00') },
    { done: true, doneAt: d('2026-10-23T08:00:00') }, { done: true, doneAt: d('2026-10-19T08:00:00') },
    { done: true, doneAt: d('2026-10-18T08:00:00') }, { done: false, doneAt: d('2026-10-25T08:00:00') },
  ]
  assert.deepEqual(doneStats(tasks, now), { week: 4, streak: 3 })
  assert.deepEqual(doneStats([], now), { week: 0, streak: 0 })
})

test('reminders fire at start, and 1 day / 1 hour before a deadline, once in window', () => {
  const t = (s) => new Date(s).getTime()
  const tasks = [{ id: 1, title: 'study', when: '2026-10-26', start: '14:00' }]
  assert.equal(dueReminders(t('2026-10-26T13:59:00'), tasks, []).length, 0)
  assert.equal(dueReminders(t('2026-10-26T14:03:00'), tasks, []).length, 1)
  assert.equal(dueReminders(t('2026-10-26T14:20:00'), tasks, []).length, 0)
  const dl = [{ id: 9, title: 'quiz', date: '2026-10-28', time: '10:00' }]
  assert.equal(dueReminders(t('2026-10-27T10:30:00'), [], dl)[0].body, 'Due in about 1 day (10:00).')
  assert.equal(dueReminders(t('2026-10-28T09:30:00'), [], dl)[0].body, 'Due in about 1 hour (10:00).')
  assert.equal(dueReminders(t('2026-10-28T10:00:00'), [], dl).length, 0)
})

test('lanes puts overlaps side by side and resets between clusters', () => {
  const r = lanes([{ s: 0, e: 60 }, { s: 30, e: 90 }, { s: 120, e: 180 }])
  assert.deepEqual(r.map((b) => [b.lane, b.lanes]), [[0, 2], [1, 2], [0, 1]])
})
