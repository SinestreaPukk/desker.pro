import test from 'node:test'
import assert from 'node:assert/strict'
import { AREAS, MAX_AREAS, MAX_GOALS, VISION_WORDS, stepsFor, visionSentence, mergeGoals, canAddGoal } from '../src/finder/catalog.js'
import { rankedGoals, visionOf, moveGoal, setVision } from '../src/goals.js'

test('the finder never asks more than 5 questions', () => {
  assert.equal(MAX_AREAS, 3)
  assert.deepEqual(stepsFor([]).map((s) => s.kind), ['areas', 'vision'])
  assert.deepEqual(stepsFor(['Studies', 'Money', 'Health']).map((s) => s.kind), ['areas', 'about', 'about', 'about', 'vision'])
  assert.equal(stepsFor(['Studies', 'Money', 'Health', 'Fun']).length, 5)
})

test('every area offers its choices, ready to use as titles', () => {
  assert.equal(AREAS.length, 8)
  assert.deepEqual(AREAS.find((a) => a.name === 'Studies').choices, ['Get top grades', 'Pass everything comfortably', 'Get into a program I want', 'Master a subject'])
  assert.deepEqual(VISION_WORDS, ['Freedom', 'Security', 'Mastery', 'Impact', 'Connection', 'Adventure'])
})

test('the vision sentence is worded from the tap and the goals', () => {
  assert.equal(visionSentence('Freedom', ['Launch Desker', 'Get top grades', 'Get fit']), 'Freedom: launch Desker, get top grades, get fit.')
  assert.equal(visionSentence('Mastery', ['IELTS band 8']), 'Mastery: IELTS band 8.')
  assert.equal(visionSentence('Impact', []), 'Impact.')
  assert.equal(visionSentence('', ['Get fit']), '')
})

test('new goals join the list in order, blank titles are dropped', () => {
  const { goals, left } = mergeGoals([], [{ id: 1, title: ' Get fit ', area: 'Health' }, { id: 2, title: '  ' }, { id: 3, title: 'Save more' }])
  assert.deepEqual(goals.map((g) => [g.title, g.level]), [['Get fit', 3], ['Save more', 3]])
  assert.equal(goals[0].area, 'Health')
  assert.deepEqual(left, [])
})

test('the limit of 5 stops new goals but keeps old ones, and says what did not fit', () => {
  const old = [1, 2, 3, 4].map((id) => ({ id, title: `g${id}`, level: 3 }))
  const { goals, left } = mergeGoals(old, [{ id: 8, title: 'a' }, { id: 9, title: 'b' }])
  assert.deepEqual(goals.map((g) => g.id), [1, 2, 3, 4, 8])
  assert.deepEqual(left.map((g) => g.title), ['b'])
  const seven = [1, 2, 3, 4, 5, 6, 7].map((id) => ({ id, title: `g${id}`, level: 3 }))
  assert.equal(mergeGoals(seven, [{ id: 9, title: 'x' }]).goals.length, 7)
  assert.equal(MAX_GOALS, 5)
  assert.equal(canAddGoal(old), true)
  assert.equal(canAddGoal([...old, { id: 5, title: 'v', level: 3 }]), false)
  assert.equal(canAddGoal([{ id: 0, title: 'vision', level: 0 }, ...old]), true) // the Vision is not one of the 5
})

test('moving a goal changes only the ranked order and keeps the Vision first', () => {
  const goals = [{ id: 7, title: 'V', level: 0 }, { id: 1, title: 'a', level: 3 }, { id: 2, title: 'b', level: 3 }, { id: 3, title: 'c', level: 3 }]
  assert.deepEqual(rankedGoals(goals).map((g) => g.id), [1, 2, 3])
  assert.equal(visionOf(goals).id, 7)
  assert.deepEqual(moveGoal(goals, 3, 0).map((g) => g.id), [7, 3, 1, 2])
  assert.deepEqual(moveGoal(goals, 1, 1).map((g) => g.id), [7, 2, 1, 3])
  assert.deepEqual(moveGoal(goals, 1, -1).map((g) => g.id), [7, 1, 2, 3]) // already first
  assert.deepEqual(moveGoal(goals, 3, 9).map((g) => g.id), [7, 1, 2, 3]) // already last
})

test('setting the vision rewords the old one, adds one, or clears it', () => {
  const goals = [{ id: 7, title: 'Old', level: 0 }, { id: 1, title: 'a', level: 3 }]
  assert.deepEqual(setVision(goals, ' New ', 5).map((g) => g.title), ['New', 'a'])
  assert.deepEqual(setVision([goals[1]], 'New', 5).map((g) => [g.id, g.level]), [[5, 0], [1, 3]])
  assert.deepEqual(setVision(goals, '  ', 5).map((g) => g.id), [1])
})
