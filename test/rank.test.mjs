import test from 'node:test'
import assert from 'node:assert/strict'
import { rank, dragTo, letAppDecide, doneByGoal } from '../src/rank.js'

const NOW = new Date(2026, 10, 1, 12).getTime() // 1 Nov 2026, local noon
const inDays = (n) => new Date(2026, 10, 1 + n, 12).toLocaleDateString('sv')

// Desker at #1, Grades at #2 of 3 goals, as in the plan's worked example.
const goals = [{ id: 1, title: 'Build my business', level: 3 }, { id: 2, title: 'Top grades', level: 3 }, { id: 3, title: 'Get fit', level: 3 }]
const desker = { id: 10, title: 'Work on Desker', goalId: 1 }
const midterm = (days, progress) => ({
  goals,
  projects: [{ id: 20, title: 'Statics midterm', goalId: 2, date: inDays(days), progress }],
  tasks: [desker, { id: 21, title: 'Review for Statics midterm', projectId: 20, session: true }],
})

for (const [days, progress, score, first] of [
  [30, 0, 0.975, 10],
  [7, 4, 0.975, 10],
  [7, 3, 1.2, 21],
  [7, 0, 1.3875, 21],
]) {
  test(`midterm in ${days} days at ${progress}/5 scores ${score}, so task ${first} comes first`, () => {
    const rows = rank(midterm(days, progress), NOW)
    assert.equal(rows.find((r) => r.task.id === 21).score, score)
    assert.equal(rows.find((r) => r.task.id === 10).score, 1)
    assert.equal(rows[0].task.id, first)
  })
}

for (const [days, urgency] of [[-2, 1], [0, 1], [1, 0.85], [2, 0.6], [3, 0.6], [4, 0.3], [7, 0.3], [8, 0], [40, 0]]) {
  test(`a plain task due in ${days} days has urgency ${urgency}`, () => {
    const [row] = rank({ goals, projects: [], tasks: [{ id: 1, title: 'x', goalId: 1, due: inDays(days) }] }, NOW)
    assert.equal(row.urgency, urgency)
  })
}

for (const [days, progress, urgency] of [[4, 0, 1], [5, 0, 0.85], [9, 0, 0.85], [10, 0, 0.6], [19, 0, 0.6], [20, 0, 0.3], [39, 0, 0.3], [40, 0, 0]]) {
  test(`a project with ${days} days left at ${progress}/5 has urgency ${urgency}`, () => {
    const projects = [{ id: 20, title: 'p', date: inDays(days), progress }]
    const [row] = rank({ goals, projects, tasks: [{ id: 1, title: 'x', projectId: 20 }] }, NOW)
    assert.equal(row.urgency, urgency)
  })
}

test('unanswered progress counts as 0', () => {
  const projects = [{ id: 20, title: 'p', date: inDays(10) }]
  assert.equal(rank({ goals, projects, tasks: [{ id: 1, title: 'x', projectId: 20 }] }, NOW)[0].urgency, 0.6)
})

test('a task in a project takes the higher of its own date and the project pace', () => {
  const projects = [{ id: 20, title: 'p', date: inDays(30), progress: 0 }] // 6 days per step: 0.3
  const urgency = (due) => rank({ goals, projects, tasks: [{ id: 1, title: 'x', projectId: 20, due }] }, NOW)[0].urgency
  assert.equal(urgency(inDays(1)), 0.85)
  assert.equal(urgency(inDays(20)), 0.3)
})

test('open tasks in a project at 5/5 count as one step, with no division by zero', () => {
  const projects = [{ id: 20, title: 'p', date: inDays(3), progress: 5 }]
  assert.equal(rank({ goals, projects, tasks: [{ id: 1, title: 'x', projectId: 20 }] }, NOW)[0].urgency, 0.6)
})

test('a project with no date ranks on its goal alone', () => {
  const projects = [{ id: 20, title: 'p', goalId: 2, progress: 1 }]
  const [row] = rank({ goals, projects, tasks: [{ id: 1, title: 'x', projectId: 20 }] }, NOW)
  assert.equal(row.urgency, 0)
  assert.equal(row.score, 0.75)
})

const importance = (doc, task) => rank({ projects: [], ...doc, tasks: [task] }, NOW)[0].importance

test('importance runs evenly from 1.0 down to 0.5 across ranked goals', () => {
  const five = [1, 2, 3, 4, 5].map((id) => ({ id, title: `g${id}`, level: 3 }))
  assert.deepEqual(five.map((g) => importance({ goals: five }, { id: 9, title: 'x', goalId: g.id })), [1, 0.875, 0.75, 0.625, 0.5])
})

test('a single goal counts as #1', () => {
  assert.equal(importance({ goals: [goals[0]] }, { id: 9, title: 'x', goalId: 1 }), 1)
})

test('not linked, a deleted goal and a link to the Vision all count 0.25', () => {
  const withVision = [{ id: 7, title: 'Freedom', level: 0 }, ...goals]
  assert.equal(importance({ goals: withVision }, { id: 9, title: 'x' }), 0.25)
  assert.equal(importance({ goals: withVision }, { id: 9, title: 'x', goalId: 99 }), 0.25)
  assert.equal(importance({ goals: withVision }, { id: 9, title: 'x', goalId: 7 }), 0.25)
})

test('the Vision takes no place in the goal ranking', () => {
  const withVision = [{ id: 7, title: 'Freedom', level: 0 }, ...goals]
  assert.equal(importance({ goals: withVision }, { id: 9, title: 'x', goalId: 1 }), 1)
  assert.equal(importance({ goals: withVision }, { id: 9, title: 'x', goalId: 3 }), 0.5)
})

test('with no goals at all, everything is 0.5, so urgency alone decides', () => {
  assert.equal(importance({ goals: [] }, { id: 9, title: 'x' }), 0.5)
  assert.equal(importance({ goals: [{ id: 7, title: 'Freedom', level: 0 }] }, { id: 9, title: 'x', goalId: 7 }), 0.5)
  const rows = rank({ goals: [], projects: [], tasks: [{ id: 1, title: 'later', due: inDays(7) }, { id: 2, title: 'soon', due: inDays(1) }] }, NOW)
  assert.equal(rows[0].task.id, 2)
})

test('a project goal outranks a stale goal copied onto its task', () => {
  const projects = [{ id: 20, title: 'p', goalId: 3 }]
  assert.equal(importance({ goals, projects }, { id: 9, title: 'x', projectId: 20, goalId: 1 }), 0.5)
})

test('an unlinked project falls back to the goal on its task', () => {
  const projects = [{ id: 20, title: 'p' }]
  assert.equal(importance({ goals, projects }, { id: 9, title: 'x', projectId: 20, goalId: 1 }), 1)
})

test('ties go to the earlier date, and no date goes last', () => {
  const rows = rank({ goals: [], projects: [{ id: 20, title: 'p', date: inDays(30) }], tasks: [
    { id: 1, title: 'none' }, { id: 2, title: 'later', due: inDays(20) }, { id: 3, title: 'sooner', due: inDays(9) }, { id: 4, title: 'in project', projectId: 20, due: inDays(10) },
  ] }, NOW)
  assert.deepEqual(rows.map((r) => r.task.id), [4, 3, 2, 1]) // 4 has urgency 0.3 from the project pace
  const tied = rank({ goals: [], projects: [], tasks: [{ id: 1, title: 'a', due: inDays(20) }, { id: 2, title: 'b', due: inDays(9) }] }, NOW)
  assert.deepEqual(tied.map((r) => r.task.id), [2, 1])
})

test('finished and fun tasks are left out', () => {
  const rows = rank({ goals, projects: [], tasks: [{ id: 1, title: 'a', done: true }, { id: 2, title: 'b', fun: true }, { id: 3, title: 'c' }] }, NOW)
  assert.deepEqual(rows.map((r) => r.task.id), [3])
})

const statics = { goals, projects: [{ id: 20, title: 'Statics midterm', goalId: 2, date: inDays(3), progress: 2 }], tasks: [] }
const why = (doc, task) => rank({ ...doc, tasks: [task] }, NOW)[0].why

test('the reason gives progress against time and the goal served', () => {
  assert.equal(why(statics, { id: 21, title: 'Review', projectId: 20, session: true }), 'Progress 2/5 with 3 days left. Serves goal #2, Top grades.')
})

test('the reason counts goal rank without the Vision', () => {
  const doc = { ...statics, goals: [{ id: 7, title: 'Freedom', level: 0 }, ...goals] }
  assert.equal(why(doc, { id: 21, title: 'Review', projectId: 20 }), 'Progress 2/5 with 3 days left. Serves goal #2, Top grades.')
})

test('the reason for a project with one day, today or a passed date', () => {
  const at = (days) => why({ goals: [], projects: [{ id: 20, title: 'p', date: inDays(days), progress: 1 }] }, { id: 1, title: 'x', projectId: 20 })
  assert.equal(at(1), 'Progress 1/5 with 1 day left.')
  assert.equal(at(0), 'Progress 1/5, due today.')
  assert.equal(at(-2), 'Progress 1/5, 2 days past due.')
})

test('the reason for a project with no date gives its progress only', () => {
  assert.equal(why({ goals, projects: [{ id: 20, title: 'p', goalId: 1, progress: 3 }] }, { id: 1, title: 'x', projectId: 20 }), 'Progress 3/5. Serves goal #1, Build my business.')
})

test('the reason for a plain task gives its date and goal', () => {
  const at = (days) => why({ goals, projects: [] }, { id: 1, title: 'x', goalId: 1, due: inDays(days) })
  assert.equal(at(0), 'Due today. Serves goal #1, Build my business.')
  assert.equal(at(1), 'Due tomorrow. Serves goal #1, Build my business.')
  assert.equal(at(5), 'Due in 5 days. Serves goal #1, Build my business.')
  assert.equal(at(-1), 'Was due yesterday. Serves goal #1, Build my business.')
  assert.equal(at(-3), 'Was due 3 days ago. Serves goal #1, Build my business.')
})

test('a task own date is the reason when it is more urgent than the project pace', () => {
  const doc = { goals: [], projects: [{ id: 20, title: 'p', date: inDays(30), progress: 0 }] }
  assert.equal(why(doc, { id: 1, title: 'x', projectId: 20, due: inDays(1) }), 'Due tomorrow.')
})

test('the reason for a task with no date and no goal says so', () => {
  assert.equal(why({ goals, projects: [] }, { id: 1, title: 'x' }), 'Not linked to a goal.')
  assert.equal(why({ goals: [], projects: [] }, { id: 1, title: 'x' }), 'No date.')
})

for (const [days, goalId, box] of [[1, 1, 0], [30, 1, 1], [1, undefined, 2], [30, undefined, 3], [3, 3, 0], [4, 3, 1]]) {
  test(`a task due in ${days} days with goal ${goalId} lands in matrix box ${box}`, () => {
    assert.equal(rank({ goals, projects: [], tasks: [{ id: 1, title: 'x', goalId, due: inDays(days) }] }, NOW)[0].box, box)
  })
}

const dragged = (box) => dragTo({ tasks: [{ id: 1, title: 'x', goalId: 1, due: inDays(1) }], projects: [] }, 1, box)
const placed = (d, more = {}) => rank({ goals, ...d, ...more }, NOW)[0]

for (const [box, importance, urgency] of [[0, 1, 0.6], [1, 1, 0], [2, 0.25, 0.6], [3, 0.25, 0]]) {
  test(`a task dragged to matrix box ${box} counts as importance ${importance}, urgency ${urgency}`, () => {
    const row = placed(dragged(box))
    assert.equal(row.importance, importance)
    assert.equal(row.urgency, urgency)
    assert.equal(row.box, box)
  })
}

test('a dragged task stays in its box at any date', () => {
  for (const due of [inDays(-5), inDays(0), inDays(60), undefined]) {
    const d = dragTo({ tasks: [{ id: 1, title: 'x', due }], projects: [] }, 1, 3)
    assert.equal(placed(d).box, 3)
  }
})

test('"Let the app decide" restores the calculated rank', () => {
  const before = placed({ tasks: [{ id: 1, title: 'x', goalId: 1, due: inDays(1) }], projects: [] })
  const after = placed(letAppDecide(dragged(3), 1))
  assert.deepEqual(after, before)
})

test('a dragged session is remembered on its project, so tomorrow\'s session keeps it', () => {
  const projects = [{ id: 20, title: 'p', goalId: 1, date: inDays(1), progress: 0 }]
  const d = dragTo({ tasks: [{ id: 5, title: 'Work on p', projectId: 20, session: true }], projects }, 5, 3)
  assert.equal(d.tasks[0].important, undefined)
  const tomorrow = { tasks: [{ id: 6, title: 'Work on p', projectId: 20, session: true }], projects: d.projects }
  assert.equal(placed(tomorrow).box, 3)
  assert.equal(placed(letAppDecide(tomorrow, 6)).box, 0)
})

test('a note on a project moves only its sessions, not the tasks you added to it', () => {
  const projects = [{ id: 20, title: 'p', goalId: 1, urgent: false, important: false }]
  assert.equal(placed({ tasks: [{ id: 7, title: 'Mine', projectId: 20 }], projects }).importance, 1)
})

test('a task own date is the reason when its project has no date, however far away', () => {
  const doc = { goals: [], projects: [{ id: 20, title: 'p', progress: 1 }] }
  assert.equal(why(doc, { id: 1, title: 'x', projectId: 20, due: inDays(20) }), 'Due in 20 days.')
})

test('an unreadable date counts as no date instead of breaking the whole list', () => {
  const rows = rank({ goals: [], projects: [{ id: 20, title: 'p', date: 'soon' }], tasks: [
    { id: 1, title: 'bad due', due: '2020-01-01T10:00' }, { id: 2, title: 'bad project', projectId: 20 },
  ] }, NOW)
  assert.deepEqual(rows.map((r) => r.urgency), [0, 0])
  assert.equal(rows[0].why, 'No date.')
  assert.equal(rows[1].why, 'Progress 0/5.')
})

test('"Let the app decide" also clears the old "you placed this" reason', () => {
  const d = letAppDecide({ tasks: [{ id: 1, title: 'x', important: true, urgent: true, manual: true, reason: 'You placed this here yourself.' }], projects: [] }, 1)
  assert.deepEqual(d.tasks[0], { id: 1, title: 'x' })
})

test('each row carries a short label for the list', () => {
  const short = (doc, task) => rank({ goals, projects: [], ...doc, tasks: [task] }, NOW)[0].short
  assert.equal(short({}, { id: 1, title: 'x', goalId: 1 }), '#1 goal')
  assert.equal(short({}, { id: 1, title: 'x' }), 'No goal')
  assert.equal(short({}, { id: 1, title: 'x', due: inDays(0) }), 'Due today')
  assert.equal(short({}, { id: 1, title: 'x', due: inDays(-1) }), 'Overdue')
  assert.equal(short({}, { id: 1, title: 'x', due: '2026-11-06' }), 'Due Fri')
  assert.equal(short({}, { id: 1, title: 'x', due: '2026-11-18' }), 'Due 18 Nov')
  const projects = [{ id: 20, title: 'p', date: inDays(20), progress: 1 }, { id: 21, title: 'q', goalId: 3, progress: 2 }]
  assert.equal(short({ projects }, { id: 1, title: 'x', projectId: 20 }), '1/5, 20 days')
  assert.equal(short({ projects }, { id: 1, title: 'x', projectId: 21 }), '#3 goal')
})

test('done this week counts finished tasks and sessions under their goal, from Monday', () => {
  const monday = new Date(2026, 9, 26, 9).getTime() // NOW is Sunday 1 Nov, so its week began 26 Oct
  const before = new Date(2026, 9, 25, 9).getTime()
  const projects = [{ id: 20, title: 'p', goalId: 2 }]
  const counts = doneByGoal([
    { id: 1, goalId: 1, done: true, doneAt: monday }, { id: 2, projectId: 20, session: true, done: true, doneAt: NOW },
    { id: 3, projectId: 20, goalId: 1, done: true, doneAt: monday }, { id: 4, goalId: 1, done: true, doneAt: before },
    { id: 5, goalId: 1 }, { id: 6, fun: true, goalId: 1, done: true, doneAt: NOW }, { id: 7, done: true, doneAt: NOW },
  ], projects, NOW)
  assert.equal(counts.get(1), 1)
  assert.equal(counts.get(2), 2)
  assert.equal(counts.get(undefined), 1)
})
