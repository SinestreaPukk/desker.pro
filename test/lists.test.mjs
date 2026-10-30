import test from 'node:test'
import assert from 'node:assert/strict'
import { parseQuick, inList, groupByDate } from '../src/lists.js'

const today = new Date('2026-10-29T09:00:00') // a Thursday
const projects = [{ id: 7, title: 'Tax Return' }]

test('parseQuick: date, time, hours, project; leaves the rest as the title', () => {
  assert.deepEqual(parseQuick('Call dentist tomorrow 3pm for 1.5h #tax', projects, today),
    { title: 'Call dentist', hours: 1.5, projectId: 7, due: '2026-10-30', when: '2026-10-30', start: '15:00' })
  assert.deepEqual(parseQuick('Buy milk', projects, today), { title: 'Buy milk' })
  assert.equal(parseQuick('Gym on monday', projects, today).due, '2026-11-02')
  assert.equal(parseQuick('Review at 14:30', projects, today).when, '2026-10-29')
  assert.equal(parseQuick('12am party', [], today).start, '00:00')
  assert.equal(parseQuick('Fix #unknown bug', projects, today).title, 'Fix bug #unknown') // unknown project tags stay in the title
  assert.equal(parseQuick('tomorrow', [], today).title, 'tomorrow') // nothing left: keep the text
})

test('smart lists and groups', () => {
  const ts = [{ id: 1, due: '2026-10-28' }, { id: 2, when: '2026-10-29' }, { id: 3, due: '2026-10-30' }, { id: 4, due: '2026-12-01' },
    { id: 5 }, { id: 6, projectId: 7 }, { id: 7, done: true, due: '2026-10-29' }]
  const ids = (l) => ts.filter((t) => inList(t, l, '2026-10-29')).map((t) => t.id)
  assert.deepEqual(ids('today'), [1, 2])
  assert.deepEqual(ids('week'), [1, 2, 3])
  assert.deepEqual(ids('inbox'), [5])
  assert.deepEqual(ids('p:7'), [6])
  assert.deepEqual(ids('done'), [7])
  assert.deepEqual(groupByDate(ts.slice(0, 6), '2026-10-29').map((g) => g.name), ['Overdue', 'Today', 'Tomorrow', 'Later', 'No date'])
})

test('a task with a start date spans a range: listed Today from its start, in the Today group', () => {
  const t = { id: 1, title: 'Thesis', from: '2026-10-20', due: '2026-12-01' }
  assert.equal(inList(t, 'today', '2026-10-29'), true)
  assert.equal(inList({ ...t, from: '2026-11-20' }, 'today', '2026-10-29'), false)
  assert.equal(inList({ ...t, from: '2026-11-20' }, 'week', '2026-10-29'), false)
  assert.deepEqual(groupByDate([t], '2026-10-29').map((g) => g.name), ['Today'])
})
