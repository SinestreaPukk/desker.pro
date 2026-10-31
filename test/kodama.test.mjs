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

import { needsName } from '../src/kodama.js'
import { startFrom } from '../src/onboarding.js'
test('the naming question is asked once, of people who never chose a name', () => {
  assert.equal(needsName({}), true)
  assert.equal(needsName({ kodama: { name: 'Moss' } }), false)
  assert.equal(needsName({ kodama: { nameAsked: true } }), false, 'keeping the default also ends it')
  const fresh = startFrom({ tasks: [], deadlines: [] }, { skipped: true })
  assert.equal(needsName(fresh), false, 'people who just signed up were asked in the welcome')
  assert.equal(nameOf(fresh), 'Kodama')
  assert.equal(nameOf(startFrom({ tasks: [], deadlines: [] }, { kodama: 'Moss' })), 'Moss')
})

import { wrapHour, wrapReply, wrappedToday, followUpDue } from '../src/kodama.js'
test('the evening wrap-up opens at 18:00 or the hour the student chose, and is not due once done', () => {
  const data = (k = {}) => ({ tasks: [{ id: 1, title: 'a', hours: 1, when: DAY }], kodama: k })
  assert.equal(wrapHour(data()), 18)
  assert.equal(ritualDue(data(), at(DAY, 17, 30)), null)
  assert.equal(ritualDue(data(), at(DAY, 18)), 'evening')
  assert.equal(ritualDue(data({ wrapAt: 21 }), at(DAY, 20)), null)
  assert.equal(ritualDue(data({ wrapAt: 21 }), at(DAY, 21)), 'evening')
  assert.equal(wrapHour(data({ wrapAt: 3 })), 18, 'a silly value falls back')
  const done = data({ rituals: { evening: [DAY] }, feel: { [DAY]: 'Tough' } })
  assert.equal(ritualDue(done, at(DAY, 19)), null)
  assert.equal(wrappedToday(done, DAY), true)
  assert.match(wrapReply(done, DAY), /tough/)
  assert.match(wrapReply({}, DAY), /wrap/)
})

test('the line under the kodama says something true, never just "Ready when you are"', () => {
  const noon = at(DAY, 15) // after the morning plan, before the wrap-up
  const lines = [
    { tasks: [{ id: 1, title: 'Read', hours: 1, when: DAY }] },
    { tasks: [], deadlines: [{ id: 1, title: 'Static quiz', date: '2026-11-02' }] },
    { tasks: [{ id: 1, title: 'Read', hours: 2 }, { id: 2, title: 'Write', hours: 1 }] },
  ].map((d) => lineFor(d, { now: noon }))
  assert.match(lines[0], /1 thing is planned today, about/)
  assert.match(lines[1], /Static quiz is due in 2 days/)
  assert.match(lines[2], /2 things open, about/)
  for (const l of lines) assert.doesNotMatch(l, /Ready when you are/)
})

test('a deadline that passed in the last week is asked about once', () => {
  const d = (date, extra) => ({ id: date, title: 'Quiz', date, ...extra })
  assert.equal(followUpDue({ deadlines: [d('2026-10-30')] }, DAY).date, '2026-10-30')
  assert.equal(followUpDue({ deadlines: [d(DAY)] }, DAY), null, 'not before it has passed')
  assert.equal(followUpDue({ deadlines: [d('2026-10-20')] }, DAY), null, 'not weeks later')
  assert.equal(followUpDue({ deadlines: [d('2026-10-30', { followed: true })] }, DAY), null)
  assert.equal(followUpDue({ deadlines: [d('2026-10-28'), d('2026-10-30')] }, DAY).date, '2026-10-30', 'the newest first')
})
