import test from 'node:test'
import assert from 'node:assert/strict'
import { badgesOf, nextBadge, badgeStats, habitStreak, habitDays } from '../src/game.js'
import { legacyXp, legacyGrowth, growthOf, STAGES } from '../src/kodama.js'
import * as game from '../src/game.js'
import { learned, recap } from '../src/insights.js'

const at = (d, h = 10) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`).getTime()
const outcome = (task, est, actual, pred, when = '2026-10-20') => ({ task, at: at(when), type: 'Reading', est, actual, src: 'tap', ...(pred && { pred }) })

test('there is no XP, level or daily quest any more: growth is the only progression', () => {
  for (const gone of ['totalXp', 'xpOf', 'levelOf', 'questOf', 'taskXp']) assert.equal(game[gone], undefined, gone)
})

test('badges reward honest habits, not how many tasks were ticked', () => {
  const got = (d) => badgesOf(d).filter((b) => b.got).map((b) => b.id)
  assert.deepEqual(got({}), [])
  assert.deepEqual(got({ tasks: Array.from({ length: 60 }, (_, i) => ({ id: i, done: true, doneAt: at('2026-10-20') })) }), [], 'sixty ticks earn nothing')
  assert.deepEqual(got({ rhythm: { outcomes: [outcome(1, 1, 1)] } }), ['timed'])
  assert.deepEqual(got({ rhythm: { outcomes: [], archive: { Reading: { n: 4 } } } }), ['timed'], 'archived timings count')
  assert.deepEqual(got({ kodama: { rituals: { morning: ['2026-10-20'], evening: ['2026-10-20'] } } }).sort(), ['morning', 'wrapup'])
  assert.deepEqual(got({ energyLog: Array.from({ length: 7 }, (_, i) => ({ at: i, level: 'high' })) }), [])
  assert.deepEqual(got({ energyLog: Array.from({ length: 8 }, (_, i) => ({ at: i, level: 'high' })) }), ['energy8'])
  assert.deepEqual(got({ tasks: [{ spent: 5.5 }] }), ['focus'])
  assert.deepEqual(got({ rhythm: { sessions: [{ start: 1, active: 300 }] } }), ['focus'], '5 hours of focus sessions')
})

test('sharper plan: a week where the plan was closer than the guess, with at least 3 timings', () => {
  const close = [1, 2, 3].map((i) => outcome(i, 1, 2, 1.9)) // guessed 1h, took 2h, plan said 1.9h
  const far = [1, 2, 3].map((i) => outcome(i, 1, 2, 0.8))
  assert.equal(badgeStats({ rhythm: { outcomes: close } }).closer, 1)
  assert.equal(badgeStats({ rhythm: { outcomes: far } }).closer, 0)
  assert.equal(badgeStats({ rhythm: { outcomes: close.slice(0, 2) } }).closer, 0, 'two timings are not enough to say')
})

test('the next badge is the unearned one you are furthest along on', () => {
  const b = badgesOf({ energyLog: Array.from({ length: 6 }, (_, i) => ({ at: i, level: 'low' })) })
  assert.equal(nextBadge(b).id, 'energy8')
  assert.equal(nextBadge(b).now, 6)
  assert.equal(nextBadge(badgesOf({})).id, 'timed')
  const all = badgesOf({ rhythm: { outcomes: [outcome(1, 1, 2, 1.9), outcome(2, 1, 2, 1.9), outcome(3, 1, 2, 1.9)], sessions: [{ start: 1, active: 400 }] },
    kodama: { rituals: { morning: ['x'], evening: ['y'] } }, energyLog: Array.from({ length: 8 }, (_, i) => ({ at: i, level: 'low' })) })
  assert.equal(all.every((x) => x.got), true)
  assert.equal(nextBadge(all), undefined)
})

test('habit streak: any honest habit counts, two rest days a week are forgiven, a third breaks it', () => {
  const now = at('2026-10-30', 15) // a Friday
  const log = (...ds) => ({ energyLog: ds.map((d) => ({ at: at(d), level: 'high' })) })
  assert.equal(habitStreak({}, now), 0)
  assert.equal(habitStreak(log('2026-10-30', '2026-10-29', '2026-10-28'), now), 3)
  assert.equal(habitStreak(log('2026-10-29', '2026-10-28'), now), 2, 'today is not over yet, so no tap today does not hurt')
  assert.equal(habitStreak(log('2026-10-30', '2026-10-27'), now), 2, 'two rest days in a row are forgiven (and not counted)')
  assert.equal(habitStreak(log('2026-10-30', '2026-10-26'), now), 1, 'a third rest day in the week breaks it')
  const mixed = { energyLog: [{ at: at('2026-10-30') }], kodama: { rituals: { evening: ['2026-10-29'] } }, rhythm: { sessions: [{ start: at('2026-10-28'), active: 20 }] } }
  assert.equal(habitStreak(mixed, now), 3, 'a tap, a wrap-up and a focus session are all habits')
  assert.deepEqual([...habitDays(mixed)].sort(), ['2026-10-28', '2026-10-29', '2026-10-30'])
  assert.equal(habitStreak({ tasks: Array.from({ length: 30 }, (_, i) => ({ done: true, doneAt: at('2026-10-30') - i * 864e5 })) }, now), 0, 'ticking tasks is not a habit streak')
})

test('old XP becomes growth once and nobody goes backwards', () => {
  assert.equal(legacyXp({}), 0)
  assert.equal(legacyXp({ tasks: [{ done: true }, { done: true, fun: true }, { done: false }] }), 15)
  assert.equal(legacyXp({ tasks: [{ done: true, important: true, urgent: true, hours: 1 }] }), 22)
  assert.equal(legacyXp({ goals: [{ milestones: [{ at: 'x' }, {}] }], guide: { done: true } }), 75)
  assert.equal(legacyXp({ xp: 120, tasks: [] }), 120, 'the saved high-water mark wins when tasks were deleted')
  assert.equal(legacyXp({ xp: 'x', tasks: [] }), 0)
  assert.equal(legacyGrowth(225), 28)
  // level 4 (225 XP) used to be a long way in; as growth it is a stage they have really reached, never lower than they had
  assert.equal(growthOf({ kodama: { legacy: legacyGrowth(225) } }).stage.name, 'Sprout')
  assert.equal(growthOf({ kodama: { legacy: legacyGrowth(1200) } }).stage.name, 'Young tree')
  assert.ok(STAGES.length === 5)
})

const doneOn = (...ds) => ds.map((d, i) => ({ id: i, done: true, doneAt: at(d) }))
test('insights: only says what the data supports', () => {
  assert.deepEqual(learned({ tasks: [] }), [])
  const mornings = Array.from({ length: 6 }, (_, i) => ({ done: true, doneAt: at('2026-10-2' + i, 9) }))
  assert.match(learned({ tasks: mornings })[0], /morning/)
  const r = recap({ tasks: doneOn('2026-10-26', '2026-10-27', '2026-10-20'), goals: [{ milestones: [{ at: '2026-10-27' }, { at: '2026-10-01' }] }] }, at('2026-10-30'))
  assert.deepEqual([r.done, r.last, r.milestones], [2, 1, 1])
})
