import test from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL ||= 'postgres://u:p@localhost/db' // _store builds a client at import; no query is sent
const { toRows, fromRow, hasContent } = await import('../api/_store.js')

const doc = {
  goals: [{ id: 1, title: 'Fit', level: 1, happiness: true }],
  projects: [{ id: 2, title: 'Portfolio', kind: 'Investment', date: '2026-12-01', goalId: 1, hours: 8, custom: 'keep me' }],
  deadlines: [{ id: 3, title: 'Quiz', date: '2026-11-05', hours: 6 }],
  tasks: [
    { id: 10, title: 'Read', due: '2026-11-02', projectId: 2, deadlineId: 3, hours: 2, done: false, subs: [{ id: 1, title: 's', done: false }], extraField: { a: 1 } },
    { id: 11, title: 'Orphan', projectId: 999, deadlineId: 888, goalId: 777, important: true },
    { id: 12, title: '', due: 'nonsense' },        // empty title: dropped
    { id: 'x', title: 'bad id' },                  // not a safe integer: dropped
  ],
}

test('hasContent', () => {
  assert.equal(hasContent({ goals: [], tasks: [] }), false)
  assert.equal(hasContent(doc), true)
})

test('toRows drops bad rows, keeps order and nulls dangling links', () => {
  const r = toRows(doc)
  assert.deepEqual(r.tasks.map((t) => t.id), [10, 11])
  const orphan = r.tasks[1]
  assert.equal(orphan.project_id, null); assert.equal(orphan.deadline_id, null); assert.equal(orphan.goal_id, null)
  assert.equal(r.tasks[0].project_id, 2) // real links survive
  assert.equal(r.goals[0].level, 1)
})

test('a row survives the round trip, including unknown fields', () => {
  const r = toRows(doc)
  const back = fromRow('tasks', r.tasks[0])
  assert.deepEqual(back, doc.tasks[0])
  assert.deepEqual(fromRow('projects', r.projects[0]), doc.projects[0])
  assert.deepEqual(fromRow('deadlines', r.deadlines[0]), doc.deadlines[0])
  // the DB hands bigint/numeric back as strings
  assert.equal(fromRow('tasks', { ...r.tasks[0], id: '10', hours: '2' }).hours, 2)
})
