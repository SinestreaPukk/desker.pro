import test from 'node:test'
import assert from 'node:assert/strict'
import { kodamaMood, addMilestone, toggleMilestone, removeMilestone, progress, prevDay } from '../src/milestones.js'

const goals = [{ id: 1, title: 'Graduate', level: 2 }]

test('milestones: add, tick with today, untick, remove', () => {
  let g = addMilestone(goals, 1, '  Finish thesis outline ', 10)
  assert.deepEqual(g[0].milestones, [{ id: 10, title: 'Finish thesis outline' }])
  assert.equal(addMilestone(g, 1, '   ', 11), g, 'blank titles are ignored')
  g = toggleMilestone(g, 1, 10, '2026-10-31')
  assert.deepEqual(progress(g[0]), { done: 1, total: 1 })
  g = toggleMilestone(g, 1, 10, '2026-10-31')
  assert.deepEqual(progress(g[0]), { done: 0, total: 1 })
  assert.deepEqual(removeMilestone(g, 1, 10)[0].milestones, [])
})

test('kodama: happy today, lucky the next day, otherwise unchanged', () => {
  const g = [{ id: 1, title: 'x', milestones: [{ id: 1, title: 'a', at: '2026-10-30' }] }]
  assert.deepEqual(kodamaMood(g, '2026-10-30'), { mood: 'happy', happy: true, lucky: false })
  assert.deepEqual(kodamaMood(g, '2026-10-31'), { mood: 'lucky', happy: false, lucky: true })
  assert.deepEqual(kodamaMood(g, '2026-11-01'), { mood: 'idle', happy: false, lucky: false })
  assert.deepEqual(kodamaMood([], '2026-10-31'), { mood: 'idle', happy: false, lucky: false })
  const both = [{ id: 1, title: 'x', milestones: [{ id: 1, title: 'a', at: '2026-10-30' }, { id: 2, title: 'b', at: '2026-10-31' }] }]
  assert.deepEqual(kodamaMood(both, '2026-10-31'), { mood: 'happy', happy: true, lucky: true })
  assert.equal(prevDay('2026-03-01'), '2026-02-28')
})
