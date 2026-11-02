import test from 'node:test'
import assert from 'node:assert/strict'
import { weekReview } from '../src/review.js'

test('weekReview counts what was finished this week, goal by goal', () => {
  const now = new Date('2026-10-28T12:00:00').getTime() // Wednesday; the week began Monday 26 Oct
  const at = new Date('2026-10-27T09:00:00').getTime()
  const goals = [{ id: 9, title: 'Freedom', level: 0 }, { id: 1, title: 'Build', level: 3 }, { id: 2, title: 'Grades', level: 3 }]
  const projects = [{ id: 5, title: 'p', goalId: 2 }]
  const tasks = [{ goalId: 1, done: true, doneAt: at }, { projectId: 5, session: true, done: true, doneAt: at }, { projectId: 5, done: true, doneAt: at }, { done: true, doneAt: at }, { goalId: 1 }]
  const r = weekReview(tasks, goals, projects, now)
  assert.equal(r.total, 4)
  assert.equal(r.text, 'Finished this week: #1 Build: 1, #2 Grades: 2, not linked to a goal: 1. 4 in all.')
})
