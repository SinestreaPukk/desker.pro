import test from 'node:test'
import assert from 'node:assert/strict'
import { nameOf, growthOf, STAGES, legacyGrowth, ritualDue, finishRitual, skipRitual, stateOf, lineFor, sceneChoice } from '../src/kodama.js'
import { cleanName, PERSONA, personaPrompt } from '../src/persona.js'

const at = (day, h, m = 0) => new Date(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
const DAY = '2026-10-31'
const open = (extra = {}) => ({ id: 1, title: 'Read ch 4', hours: 1, ...extra })

test('the name is the user\'s, tidied, with a default', () => {
  assert.equal(nameOf({}), 'Kodama')
  assert.equal(nameOf({ kodama: { name: '  Moss   ' } }), 'Moss')
  assert.equal(cleanName('x'.repeat(50)).length, PERSONA.maxName)
  assert.equal(cleanName('   '), 'Kodama')
  assert.match(personaPrompt('Moss'), /You are Moss/)
})

test('growth counts honest habits, caps volume per day, and keeps the old XP as a one-time gift', () => {
  assert.equal(growthOf({}).stage.name, 'Seedling')
  const spam = Array.from({ length: 40 }, (_, i) => ({ id: i, done: true, doneAt: at(DAY, 10).getTime() + i }))
  assert.equal(growthOf({ tasks: spam }).points, 5, 'forty ticks in a day count as five')
  const timed = { rhythm: { outcomes: Array.from({ length: 10 }, (_, i) => ({ task: i })), archive: { Reading: { n: 5 } } } }
  assert.equal(growthOf(timed).points, 45)
  assert.equal(growthOf(timed).stage.name, 'Sprout')
  assert.equal(growthOf({ kodama: { legacy: legacyGrowth(400) } }).points, 50)
  const g = growthOf({ kodama: { legacy: 30 } })
  assert.equal(g.toNext, STAGES[2].from - 30)
})

test('growth never goes down when work is deleted or time passes away', () => {
  const before = growthOf({ kodama: { legacy: 40, rituals: { morning: ['2026-10-01'] } } }).points
  const after = growthOf({ kodama: { legacy: 40, rituals: { morning: ['2026-10-01'], evening: [] }, away: 30 } }).points
  assert.ok(after >= before)
})

test('window view unlocks follow growth, not XP', () => {
  assert.deepEqual(sceneChoice({ scene: { variant: 'night', season: 'winter' } }), { variant: undefined, season: undefined })
  assert.deepEqual(sceneChoice({ scene: { variant: 'night', season: 'winter' }, kodama: { legacy: 30 } }), { variant: 'night', season: undefined })
  assert.deepEqual(sceneChoice({ scene: { variant: 'night', season: 'winter' }, kodama: { legacy: 80 } }), { variant: 'night', season: 'winter' })
})

test('rituals: morning when there is something open, evening after a day with work, each once, and skippable', () => {
  const d = { tasks: [open({ when: DAY })] }
  assert.equal(ritualDue(d, at(DAY, 8)), 'morning')
  assert.equal(ritualDue(d, at(DAY, 14)), null)
  assert.equal(ritualDue(d, at(DAY, 19)), 'evening')
  assert.equal(ritualDue({ tasks: [] }, at(DAY, 8)), null)
  assert.equal(ritualDue(finishRitual(d, 'morning', DAY), at(DAY, 8)), null)
  assert.equal(ritualDue(finishRitual(d, 'evening', DAY), at(DAY, 19)), null)
  assert.equal(ritualDue(skipRitual(d, 'morning', DAY), at(DAY, 8)), null)
  assert.equal(ritualDue(skipRitual(d, 'morning', '2026-10-30'), at(DAY, 8)), 'morning', 'a skip is for one day only')
  assert.deepEqual(finishRitual(finishRitual(d, 'morning', DAY), 'morning', DAY).kodama.rituals.morning, [DAY])
})

test('state: timer, late night, milestone, just finished, wrapped up, heavy day', () => {
  const base = { tasks: [open()], goals: [] }
  assert.equal(stateOf(base, { focusing: true, now: at(DAY, 10) }), 'focus')
  assert.equal(stateOf(base, { now: at(DAY, 23, 30) }), 'sleepy')
  assert.equal(stateOf({ ...base, goals: [{ id: 1, milestones: [{ id: 1, at: DAY }] }] }, { now: at(DAY, 10) }), 'happy')
  const now = at(DAY, 15)
  assert.equal(stateOf({ ...base, tasks: [open({ done: true, doneAt: now.getTime() - 60_000 })] }, { now }), 'happy')
  assert.equal(stateOf(finishRitual(base, 'evening', DAY), { now: at(DAY, 20) }), 'cozy')
  assert.equal(stateOf(base, { now, heavy: true }), 'calm')
  assert.equal(stateOf(base, { now }), 'idle')
})

test('what it says: late night is rest, coming back is gentle, rituals are offered', () => {
  const d = { tasks: [open({ when: DAY })], goals: [] }
  assert.match(lineFor(d, { now: at(DAY, 23, 40) }), /rest/i)
  assert.match(lineFor({ ...d, kodama: { away: 9 } }, { now: at(DAY, 15) }), /Welcome back/)
  assert.match(lineFor(d, { now: at(DAY, 8) }), /Good morning/)
  assert.match(lineFor(d, { now: at(DAY, 19) }), /How did today go/)
  assert.match(lineFor({ tasks: [], goals: [], kodama: { name: 'Moss' } }, { now: at(DAY, 15) }), /I am Moss/)
  assert.match(lineFor(d, { now: at(DAY, 15), focusing: true }), /right here/)
})

test('it says when the day is too much, kindly', () => {
  const tasks = [open({ id: 1, hours: 3, when: DAY }), open({ id: 2, hours: 3, when: DAY })]
  assert.match(lineFor({ tasks, freeHours: 4, onboarding: { slow: 'Almost always' } }, { now: at(DAY, 15) }), /spread it out/)
  assert.doesNotMatch(lineFor({ tasks, freeHours: 4, onboarding: { slow: 'Almost always' } }, { now: at(DAY, 19) }), /spread it out/, 'in the evening the wrap-up comes first')
})

test('wellbeing guardrail: no line ever shames, counts missed days, or pushes', () => {
  const BAD = /fail|lazy|behind|missed|streak|lost|hurry|should have|disappoint|only \d+ days|slack/i
  const samples = []
  for (const h of [3, 8, 11, 15, 19, 23]) for (const away of [0, 2, 10]) for (const t of [[], [open()], [open({ when: DAY })], [open({ done: true, doneAt: at(DAY, 9).getTime() })]]) {
    samples.push(lineFor({ tasks: t, goals: [], kodama: { away } }, { now: at(DAY, h) }))
    samples.push(lineFor({ tasks: t, goals: [], kodama: { away } }, { now: at(DAY, h), focusing: true }))
  }
  for (const s of new Set(samples)) assert.ok(!BAD.test(s), `"${s}" reads as pressure`)
  assert.ok(new Set(samples).size >= 6)
})
