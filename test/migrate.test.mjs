import test from 'node:test'
import assert from 'node:assert/strict'
import { convertGoals, convertData, upgrade, migrate } from '../src/storage.js'

const titles = (list) => list.map((x) => x.title)

test('the pyramid becomes a ranked list: starred first, then long-term to short-term', () => {
  const out = convertGoals({ goals: [
    { id: 1, title: 'Short', level: 3 }, { id: 2, title: 'Mid', level: 2 }, { id: 3, title: 'Long', level: 1 },
    { id: 4, title: 'Starred short', level: 3, top: true }, { id: 5, title: 'Vision', level: 0 },
  ] })
  assert.deepEqual(titles(out.goals), ['Vision', 'Starred short', 'Long', 'Mid', 'Short'])
  assert.equal(out.goals[0].level, 0)
  assert.equal(out.checkGoalOrder, true)
})

test('the first Vision stays; other Visions become goals after starred and before long-term', () => {
  const out = convertGoals({ goals: [
    { id: 1, title: 'Long', level: 1 }, { id: 2, title: 'First vision', level: 0 }, { id: 3, title: 'Second vision', level: 0 },
    { id: 4, title: 'Starred', level: 3, top: true },
  ] })
  assert.deepEqual(titles(out.goals), ['First vision', 'Starred', 'Second vision', 'Long'])
  assert.deepEqual(out.goals.map((g) => g.level === 0), [true, false, false, false])
})

test('workspaces with more than 5 goals keep them all', () => {
  const goals = [1, 2, 3, 4, 5, 6, 7].map((id) => ({ id, title: `g${id}`, level: 2 }))
  assert.equal(convertGoals({ goals }).goals.length, 7)
})

test('converting goals again keeps an order you have changed since, and no new note', () => {
  const once = convertGoals({ goals: [{ id: 1, title: 'Long', level: 1 }, { id: 2, title: 'Short', level: 3 }] })
  const reordered = { goals: [...once.goals].reverse() } // you moved Short above Long, and dismissed the note
  assert.deepEqual(convertGoals(reordered), reordered)
})

test('an already flat list with no pyramid gets no note', () => {
  const doc = { goals: [{ id: 7, title: 'Freedom', level: 0 }, { id: 1, title: 'A', level: 3 }] }
  assert.deepEqual(convertGoals(doc), doc)
})

const inProject = { id: 100, title: 'Essay draft', date: '2026-11-10', projectId: 20 }
const withTasks = { id: 101, title: 'Group report', date: '2026-11-12' }
const examLike = { id: 102, title: 'Statics midterm', date: '2026-11-04', time: '14:00' }
const plain = { id: 103, title: 'Pay fees', date: '2026-11-05' }
const old = {
  goals: [], projects: [{ id: 20, title: 'English', goalId: 1 }],
  deadlines: [inProject, withTasks, examLike, plain],
  tasks: [{ id: 1, title: 'Outline', deadlineId: 100 }, { id: 2, title: 'Find sources', deadlineId: 101 }],
}
const out = () => convertData(old)
const task = (d, title) => d.tasks.find((t) => t.title === title)
const proj = (d, title) => d.projects.find((p) => p.title === title)

test('a deadline inside a project becomes a dated task in that project, and its tasks follow', () => {
  const d = out()
  assert.equal(task(d, 'Essay draft').due, '2026-11-10')
  assert.equal(task(d, 'Essay draft').projectId, 20)
  assert.equal(task(d, 'Outline').projectId, 20)
  assert.equal(proj(d, 'Essay draft'), undefined)
})

test('a deadline with tasks becomes a dated project that keeps them', () => {
  const d = out()
  const p = proj(d, 'Group report')
  assert.equal(p.date, '2026-11-12')
  assert.equal(task(d, 'Find sources').projectId, p.id)
  assert.equal(task(d, 'Group report'), undefined)
})

test('a deadline with an exam-like title becomes a dated project, keeping its time', () => {
  const p = proj(out(), 'Statics midterm')
  assert.equal(p.date, '2026-11-04')
  assert.equal(p.time, '14:00')
})

test('any other deadline becomes a dated task', () => {
  const d = out()
  assert.equal(task(d, 'Pay fees').due, '2026-11-05')
  assert.equal(task(d, 'Pay fees').done, false)
  assert.equal(proj(d, 'Pay fees'), undefined)
})

test('a deadline already done stays done', () => {
  const d = convertData({ deadlines: [{ id: 1, title: 'Old fee', date: '2026-01-01', done: true }, { id: 2, title: 'Old exam', date: '2026-01-02', done: true }] })
  assert.equal(task(d, 'Old fee').done, true)
  assert.equal(proj(d, 'Old exam').progress, 5)
})

test('a deadline pointing at a deleted project is treated as standing alone', () => {
  const d = convertData({ projects: [], deadlines: [{ id: 1, title: 'Fee', date: '2026-01-01', projectId: 99 }] })
  assert.equal(task(d, 'Fee').projectId, undefined)
})

test('a new project never takes an id already in use', () => {
  const d = convertData({ projects: [{ id: 5, title: 'Taken' }], deadlines: [{ id: 5, title: 'Final exam', date: '2026-12-01' }] })
  assert.equal(new Set(d.projects.map((p) => p.id)).size, 2)
})

test('old deadlines are emptied, kept in a safety copy, and tasks lose the old link', () => {
  const d = out()
  assert.deepEqual(d.deadlines, [])
  assert.deepEqual(d.legacyDeadlines, old.deadlines)
  assert.ok(d.tasks.every((t) => !('deadlineId' in t)))
})

const NOW = new Date(2026, 10, 1, 12).getTime()

test('a planned day today or later becomes the due date only if the task has none', () => {
  const d = convertData({ tasks: [{ id: 1, title: 'a', when: '2026-11-03' }, { id: 2, title: 'b', when: '2026-11-01' }, { id: 3, title: 'c', when: '2026-11-03', due: '2026-11-09' }, { id: 4, title: 'd' }] }, NOW)
  assert.deepEqual(d.tasks.map((t) => t.due), ['2026-11-03', '2026-11-01', '2026-11-09', undefined])
})

test('a planned day already past stays saved but is not a due date, as a missed plan was never a deadline', () => {
  const [t] = convertData({ tasks: [{ id: 1, title: 'a', when: '2026-10-31' }] }, NOW).tasks
  assert.equal(t.due, undefined)
  assert.equal(t.when, '2026-10-31')
})

test('fun sessions stay exactly as saved', () => {
  const fun = { id: 1, title: 'Climbing', when: '2026-11-03', fun: true, important: true }
  assert.deepEqual(convertData({ tasks: [fun] }).tasks, [fun])
})

test('AI-set important, urgent and reason are cleared unless you set them yourself', () => {
  const d = convertData({ tasks: [{ id: 1, title: 'ai', important: true, urgent: false, reason: 'Because' }, { id: 2, title: 'you', important: false, urgent: true, reason: 'Mine', manual: true }] })
  assert.deepEqual(d.tasks[0], { id: 1, title: 'ai' })
  assert.deepEqual(d.tasks[1], { id: 2, title: 'you', important: false, urgent: true, reason: 'Mine', manual: true })
})

test('a project with no progress yet stays unanswered', () => {
  assert.equal(proj(out(), 'English').progress, undefined)
})

test('converting again changes nothing, and the safety copy does not grow', () => {
  const once = out()
  assert.deepEqual(convertData(once), once)
})

test('nothing else in the document is touched', () => {
  assert.deepEqual(convertData({ hobbies: ['Chess'], energyLog: [1], freeHours: 2 }).hobbies, ['Chess'])
  assert.equal(convertData({ freeHours: 2 }).freeHours, 2)
})

test('migrate converts old workspaces and stamps them, keeping everything', () => {
  const doc = { goals: [{ id: 1, title: 'g', level: 1 }], deadlines: [plain], tasks: [{ id: 2, title: 't', important: true }], projects: [] }
  const d = migrate(doc)
  assert.deepEqual(d.goals.map((g) => g.level), [3])
  assert.deepEqual(d.deadlines, [])
  assert.deepEqual(d.legacyDeadlines, [plain])
  assert.equal(d.tasks[0].important, undefined)
  assert.equal(d.schema, 2)
  assert.equal(migrate(d).checkGoalOrder, true) // still there until you dismiss it
})

const pyramid = { goals: [{ id: 1, title: 'Short', level: 3 }, { id: 2, title: 'Long', level: 1 }], tasks: [{ id: 3, title: 'a', when: '2999-11-03' }], deadlines: [plain] }

test('upgrade runs only the steps switched on so far, and stamps the document', () => {
  const goalsOnly = upgrade(pyramid, 1)
  assert.deepEqual(titles(goalsOnly.goals), ['Long', 'Short'])
  assert.deepEqual(goalsOnly.deadlines, [plain])
  assert.equal(goalsOnly.schema, 1)
  const both = upgrade(goalsOnly, 2)
  assert.deepEqual(both.deadlines, [])
  assert.equal(both.schema, 2)
})

test('after upgrading, a due date you cleared stays cleared', () => {
  const once = upgrade(pyramid, 2)
  const cleared = { ...once, tasks: once.tasks.map((t) => (t.id === 3 ? { ...t, due: undefined } : t)) }
  assert.equal(upgrade(cleared, 2).tasks.find((t) => t.id === 3).due, undefined)
})

test('after upgrading, a goal added at another level keeps its place and brings no new note', () => {
  const { checkGoalOrder, ...once } = upgrade(pyramid, 2)
  const added = { ...once, goals: [...once.goals, { id: 9, title: 'From chat', level: 1 }] }
  const again = upgrade(added, 2)
  assert.deepEqual(titles(again.goals), ['Long', 'Short', 'From chat'])
  assert.equal(again.checkGoalOrder, undefined)
})

test('after upgrading, important and urgent set through the public API stay', () => {
  const once = upgrade(pyramid, 2)
  const set = { ...once, tasks: once.tasks.map((t) => (t.id === 3 ? { ...t, important: true, urgent: false } : t)) }
  const t = upgrade(set, 2).tasks.find((x) => x.id === 3)
  assert.equal(t.important, true)
  assert.equal(t.urgent, false)
})

test('an old backup has no stamp, so it converts when restored', () => {
  const restored = upgrade(pyramid, 2)
  assert.equal(restored.schema, 2)
  assert.deepEqual(restored.legacyDeadlines, [plain])
})

test('finishing a deadline finished its tasks, so converting one leaves none open', () => {
  const d = convertData({ deadlines: [{ id: 1, title: 'Old report', date: '2020-01-01', done: true }], tasks: [{ id: 2, title: 'Left over', deadlineId: 1 }, { id: 3, title: 'Other' }] })
  assert.equal(d.tasks.find((t) => t.id === 2).done, true)
  assert.equal(d.tasks.find((t) => t.id === 3).done, undefined)
})

test('a deadline that only starts with an exam word stays a plain task', () => {
  const d = convertData({ deadlines: [{ id: 1, title: 'Final invoice to client', date: '2026-11-05' }, { id: 2, title: 'Test the checkout', date: '2026-11-06' }] })
  assert.deepEqual(d.projects, [])
  assert.deepEqual(titles(d.tasks), ['Final invoice to client', 'Test the checkout'])
})

test('a deadline ending in an exam word and a number becomes a project', () => {
  assert.equal(convertData({ deadlines: [{ id: 1, title: 'Quiz 3', date: '2026-11-05' }] }).projects[0].title, 'Quiz 3')
})
