import test from 'node:test'
import assert from 'node:assert/strict'
import { pace, sessionTitle, syncSessions, anotherSession, restingProjects } from '../src/sessions.js'

const NOW = new Date(2026, 10, 1, 12).getTime()
const inDays = (n) => new Date(2026, 10, 1 + n, 12).toLocaleDateString('sv')

test('progress 2/5 with 3 days left is 1 day per step', () => {
  const p = pace({ date: inDays(3), progress: 2 }, NOW)
  assert.equal(p.daysLeft, 3)
  assert.equal(p.perStep, 1)
})

test('a project with no date has no pace', () => {
  assert.equal(pace({ progress: 2 }, NOW), null)
})

test('days left are calendar days, even across a clock change', () => {
  const late = new Date(2026, 2, 7, 23, 30).getTime() // the night before US clocks go forward
  assert.equal(pace({ date: '2026-03-09', progress: 4 }, late).daysLeft, 2)
})

for (const [days, progress, label] of [
  [3, 0, 'Behind'], // 0.6 days per step
  [4, 1, 'Tight'], // exactly 1
  [3, 2, 'Tight'],
  [15, 1, 'Tight'], // 3.75
  [20, 0, null], // exactly 4
  [30, 0, null],
  [-1, 2, 'Behind'],
  [1, 5, null], // finished
]) {
  test(`${days} days left at ${progress}/5 is labelled ${label}`, () => {
    assert.equal(pace({ date: inDays(days), progress }, NOW).label, label)
  })
}

for (const [title, want] of [
  ['Statics midterm', 'Review for Statics midterm'],
  ['Physics TEST', 'Review for Physics TEST'],
  ['IELTS exam', 'Review for IELTS exam'],
  ['Calculus quiz', 'Review for Calculus quiz'],
  ['Maths finals', 'Review for Maths finals'],
  ['Landing page', 'Work on Landing page'],
  ['Contest entry', 'Work on Contest entry'], // "test" inside a longer word doesn't count
  ['Final exam', 'Review for Final exam'],
  ['Quiz 3', 'Review for Quiz 3'],
  ['Midterm 2', 'Review for Midterm 2'],
  ['Final invoice to client', 'Work on Final invoice to client'],
  ['Test the checkout', 'Work on Test the checkout'],
  ['Final report', 'Work on Final report'],
]) {
  test(`a project called "${title}" gets the session "${want}"`, () => {
    assert.equal(sessionTitle({ title }), want)
  })
}

test('saved session wording wins over the word list', () => {
  assert.equal(sessionTitle({ title: 'Statics midterm', sessionTitle: 'Practise problems' }), 'Practise problems')
})

const day = (n) => new Date(2026, 10, 1 + n, 12).getTime()
const project = { id: 20, title: 'Statics midterm', date: inDays(10), progress: 2 }
const open = (tasks) => tasks.filter((t) => t.session && !t.done)

test('a project with nothing to do gets one session, with no date on it', () => {
  const tasks = syncSessions([], [project], NOW)
  assert.equal(tasks.length, 1)
  assert.equal(tasks[0].title, 'Review for Statics midterm')
  assert.equal(tasks[0].projectId, 20)
  assert.equal(tasks[0].session, true)
  assert.equal(tasks[0].due, undefined)
  assert.equal(tasks[0].when, undefined)
})

test('a project with no date still gets a session', () => {
  assert.equal(open(syncSessions([], [{ id: 20, title: 'Desker' }], NOW)).length, 1)
})

test('syncing again changes nothing', () => {
  const once = syncSessions([], [project], NOW)
  assert.deepEqual(syncSessions(once, [project], NOW), once)
})

test('syncing returns the same list when nothing changed, so it never causes a save', () => {
  const once = syncSessions([], [project], NOW)
  assert.equal(syncSessions(once, [project], NOW), once)
})

test('after a session is finished, the next appears tomorrow and not today', () => {
  const [s] = syncSessions([], [project], NOW)
  const finished = [{ ...s, done: true, doneAt: NOW }]
  assert.equal(open(syncSessions(finished, [project], NOW)).length, 0)
  const next = open(syncSessions(finished, [project], day(1)))
  assert.equal(next.length, 1)
  assert.notEqual(next[0].id, s.id)
})

test('finishing your own last task also clears the project for today', () => {
  const mine = [{ id: 1, title: 'Mine', projectId: 20, done: true, doneAt: NOW }]
  assert.equal(open(syncSessions(mine, [project], NOW)).length, 0)
  assert.equal(open(syncSessions(mine, [project], day(1))).length, 1)
})

test('"Another session" adds one straight away, and syncing keeps it', () => {
  const [s] = syncSessions([], [project], NOW)
  const finished = [{ ...s, done: true, doneAt: NOW }]
  const more = anotherSession(finished, project, NOW)
  assert.equal(open(more).length, 1)
  assert.equal(open(syncSessions(more, [project], NOW)).length, 1)
})

test('"Another session" never makes a second open session', () => {
  const one = syncSessions([], [project], NOW)
  assert.equal(open(anotherSession(one, project, NOW)).length, 1)
})

test('Undo after "Another session" leaves exactly one open session', () => {
  const [s] = syncSessions([], [project], NOW)
  const more = anotherSession([{ ...s, done: true, doneAt: NOW }], project, NOW)
  const undone = more.map((t) => (t.id === s.id ? { ...t, done: false, doneAt: undefined } : t))
  const out = open(syncSessions(undone, [project], NOW))
  assert.equal(out.length, 1)
  assert.equal(out[0].id, s.id)
})

test('Undo of a finished session does not add a second one', () => {
  const [s] = syncSessions([], [project], NOW)
  assert.deepEqual(open(syncSessions([{ ...s, done: false }], [project], NOW)).map((t) => t.id), [s.id])
})

test('your own open tasks replace the session, and are never overwritten', () => {
  const [s] = syncSessions([], [project], NOW)
  const mine = { id: 1, title: 'Mine', projectId: 20, done: false }
  assert.deepEqual(syncSessions([s, mine], [project], NOW), [mine])
})

test('the session returns once your own tasks are finished, from the next day', () => {
  const mine = [{ id: 1, title: 'Mine', projectId: 20, done: true, doneAt: day(-1) }]
  assert.equal(open(syncSessions(mine, [project], NOW)).length, 1)
})

test('no sessions at 5/5, and an open one goes away', () => {
  const [s] = syncSessions([], [project], NOW)
  const finished = { ...project, progress: 5 }
  assert.deepEqual(syncSessions([s], [finished], NOW), [])
  assert.deepEqual(anotherSession([], finished, NOW), [])
})

test('sessions run through the due date and stop after it', () => {
  const at = (days) => ({ ...project, date: inDays(days) })
  assert.equal(open(syncSessions([], [at(0)], NOW)).length, 1)
  assert.equal(open(syncSessions([], [at(-1)], NOW)).length, 0)
  const [s] = syncSessions([], [at(0)], NOW)
  assert.deepEqual(syncSessions([s], [at(0)], day(1)), [])
})

test('finished sessions stay, so "Done this week" can count them', () => {
  const [s] = syncSessions([], [project], NOW)
  const done = { ...s, done: true, doneAt: NOW }
  assert.ok(syncSessions([done], [{ ...project, progress: 5 }], NOW).includes(done))
})

test('an open session goes away with its project', () => {
  const [s] = syncSessions([], [project], NOW)
  assert.deepEqual(syncSessions([s], [], NOW), [])
})

test('renaming a project rewords its open session', () => {
  const [s] = syncSessions([], [project], NOW)
  assert.equal(syncSessions([s], [{ ...project, title: 'Landing page' }], NOW)[0].title, 'Work on Landing page')
})

test('fun tasks in a project do not count as your own tasks', () => {
  assert.equal(open(syncSessions([{ id: 1, title: 'Fun', projectId: 20, fun: true }], [project], NOW)).length, 1)
})

test('new sessions get ids no other task has', () => {
  const taken = { id: NOW + 5, title: 'Other' }
  const two = syncSessions([taken], [project, { id: 21, title: 'Second' }], NOW)
  assert.equal(new Set(two.map((t) => t.id)).size, 3)
})

test('a project finished for today is listed, so another session is always one tap away', () => {
  const [s] = syncSessions([], [project], NOW)
  const finished = [{ ...s, done: true, doneAt: NOW }]
  assert.deepEqual(restingProjects(finished, [project], NOW).map((p) => p.id), [20])
  assert.deepEqual(restingProjects(anotherSession(finished, project, NOW), [project], NOW), []) // it has a session again
  assert.deepEqual(restingProjects(finished, [project], day(1)), []) // the next day it comes back by itself
  assert.deepEqual(restingProjects(finished, [{ ...project, progress: 5 }], NOW), []) // finished for good
  assert.deepEqual(restingProjects([s], [project], NOW), []) // nothing finished yet
  assert.deepEqual(restingProjects([...finished, { id: 9, title: 'Mine', projectId: 20 }], [project], NOW), []) // its own task is showing
})
