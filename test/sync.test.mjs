import test from 'node:test'
import assert from 'node:assert/strict'
import { diff, apply, isEmpty } from '../src/sync.js'

// A tiny stand-in for the server and two devices, using exactly the functions the app and the API use.
const clone = (x) => JSON.parse(JSON.stringify(x))
const start = () => ({ tasks: [{ id: 1, title: 'A', hours: 1 }, { id: 2, title: 'B', hours: 2 }], goals: [], deadlines: [], projects: [], hobbies: [], energyLog: [{ at: 1, level: 'low' }], rhythm: { outcomes: [], sessions: [], signals: [] }, kodama: { name: 'Kodama', rituals: { morning: [], evening: [] } } })
const world = () => {
  const server = { doc: start() }
  const device = () => { const d = { base: clone(server.doc), data: clone(server.doc) }; return d }
  // save: send the changes since base, take the server's merged copy as the new base, keep edits made meanwhile
  const save = (d) => { const sent = clone(d.data); server.doc = apply(server.doc, diff(d.base, d.data)); d.base = clone(server.doc); d.data = apply(clone(server.doc), diff(sent, d.data)); return d }
  // refresh: another device changed things; take the server copy and lay this device's unsaved edits on top
  const refresh = (d) => { const pending = diff(d.base, d.data); d.base = clone(server.doc); d.data = apply(clone(server.doc), pending); return d }
  return { server, device, save, refresh }
}
const task = (d, id) => d.data.tasks.find((t) => t.id === id)

test('two devices editing different tasks: both edits are kept', () => {
  const w = world(), a = w.device(), b = w.device()
  task(a, 1).title = 'A from phone'; task(b, 2).hours = 3
  w.save(a); w.save(b)
  assert.equal(w.server.doc.tasks.find((t) => t.id === 1).title, 'A from phone')
  assert.equal(w.server.doc.tasks.find((t) => t.id === 2).hours, 3)
  assert.equal(w.server.doc.tasks.length, 2)
})

test('two devices editing the same task: different fields both survive, the same field takes the later change', () => {
  const w = world(), a = w.device(), b = w.device()
  task(a, 1).title = 'New title'; task(a, 1).hours = 5
  task(b, 1).hours = 7; task(b, 1).due = '2026-11-02'
  w.save(a); w.save(b) // b arrives last
  const t = w.server.doc.tasks.find((x) => x.id === 1)
  assert.deepEqual([t.title, t.hours, t.due], ['New title', 7, '2026-11-02'])
  assert.equal(w.server.doc.tasks.find((x) => x.id === 2).title, 'B', 'nothing else changed')
})

test('two devices each adding energy check-ins: every check-in is kept, once', () => {
  const w = world(), a = w.device(), b = w.device()
  a.data.energyLog.push({ at: 10, level: 'high' }, { at: 11, level: 'medium' })
  b.data.energyLog.push({ at: 20, level: 'low' })
  w.save(a); w.save(b); w.save(a); w.save(b)
  assert.deepEqual(w.server.doc.energyLog.map((e) => e.at).sort((x, y) => x - y), [1, 10, 11, 20])
})

test('timings, sessions, signals and wrap-up days from two devices are merged by identity', () => {
  const w = world(), a = w.device(), b = w.device()
  a.data.rhythm.outcomes.push({ task: 1, at: 100, src: 'timer', est: 1, actual: 1 }); a.data.kodama.rituals.evening.push('2026-10-30')
  b.data.rhythm.outcomes.push({ task: 2, at: 200, src: 'tap', est: 1, actual: 2 }); b.data.kodama.rituals.evening.push('2026-10-31')
  b.data.rhythm.sessions.push({ start: 5, task: 2, active: 20 })
  w.save(a); w.save(b)
  assert.equal(w.server.doc.rhythm.outcomes.length, 2)
  assert.deepEqual(w.server.doc.kodama.rituals.evening, ['2026-10-30', '2026-10-31'])
  assert.equal(w.server.doc.rhythm.sessions.length, 1)
})

test('working offline: many edits, then one save, and they all arrive', () => {
  const w = world(), a = w.device(), b = w.device()
  task(b, 2).title = 'Edited elsewhere meanwhile'; w.save(b) // the server moves on while a is offline
  for (let i = 0; i < 5; i++) a.data.tasks.push({ id: 100 + i, title: `offline ${i}` })
  task(a, 1).hours = 4; a.data.energyLog.push({ at: 50, level: 'high' })
  w.save(a)
  assert.equal(w.server.doc.tasks.length, 7)
  assert.equal(w.server.doc.tasks.find((t) => t.id === 2).title, 'Edited elsewhere meanwhile')
  assert.equal(w.server.doc.tasks.find((t) => t.id === 1).hours, 4)
  assert.equal(w.server.doc.energyLog.length, 2)
})

test('edits made while a save is in flight are kept and sent next', () => {
  const w = world(), a = w.device()
  task(a, 1).title = 'first'
  const sent = clone(a.data)
  w.server.doc = apply(w.server.doc, diff(a.base, a.data)) // the request is on its way...
  task(a, 1).hours = 9 // ...and the student keeps typing
  a.base = clone(w.server.doc); a.data = apply(clone(w.server.doc), diff(sent, a.data))
  assert.equal(task(a, 1).hours, 9)
  assert.equal(isEmpty(diff(a.base, a.data)), false)
  w.save(a)
  assert.equal(w.server.doc.tasks.find((t) => t.id === 1).hours, 9)
})

test('refreshing from another device keeps unsaved local edits on top', () => {
  const w = world(), a = w.device(), b = w.device()
  task(b, 2).title = 'from laptop'; w.save(b)
  task(a, 1).title = 'typing on phone'
  w.refresh(a)
  assert.equal(task(a, 2).title, 'from laptop')
  assert.equal(task(a, 1).title, 'typing on phone')
})

test('deleting on one device: the task stays deleted, and an edit to it elsewhere does not bring it back', () => {
  const w = world(), a = w.device(), b = w.device()
  a.data.tasks = a.data.tasks.filter((t) => t.id !== 1)
  task(b, 1).title = 'edited after delete elsewhere'; task(b, 2).hours = 6
  w.save(a); w.save(b)
  assert.equal(w.server.doc.tasks.some((t) => t.id === 1), false)
  assert.equal(w.server.doc.tasks.find((t) => t.id === 2).hours, 6)
})

test('applying the same patch twice does not duplicate anything', () => {
  const doc = start(), data = clone(doc)
  data.tasks.push({ id: 9, title: 'new' }); data.energyLog.push({ at: 5, level: 'low' })
  const patch = diff(doc, data)
  const once = apply(doc, patch), twice = apply(once, patch)
  assert.deepEqual(twice, once)
})

test('removing a field and deliberately removing a list entry both travel', () => {
  const w = world(), a = w.device()
  delete task(a, 2).hours
  a.data.energyLog = []
  w.save(a)
  assert.equal('hours' in w.server.doc.tasks.find((t) => t.id === 2), false)
  assert.equal(w.server.doc.energyLog.length, 0)
})

test('xp only goes up, and an unchanged document produces an empty patch', () => {
  const w = world(), a = w.device(), b = w.device()
  a.data.xp = 200; b.data.xp = 120
  w.save(a); w.save(b)
  assert.equal(w.server.doc.xp, 200)
  assert.equal(isEmpty(diff(w.server.doc, clone(w.server.doc))), true)
})
