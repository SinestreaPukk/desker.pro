import test from 'node:test'
import assert from 'node:assert/strict'
import { parseQuick, quickDate, validAdds, isRealDate } from '../src/lists.js'

const today = new Date('2026-10-29T09:00:00') // a Thursday
const projects = [{ id: 7, title: 'Tax Return' }]

test('parseQuick: date, time, project; leaves the rest as the title', () => {
  assert.deepEqual(parseQuick('Call dentist tomorrow 3pm #tax', projects, today),
    { title: 'Call dentist', projectId: 7, due: '2026-10-30', when: '2026-10-30', start: '15:00' })
  assert.deepEqual(parseQuick('Call for 1h', [], today), { title: 'Call for 1h' }) // hours are gone, so the words stay
  assert.deepEqual(parseQuick('Quiz 3 may 5', [], today), { title: 'Quiz 3', due: '2027-05-05' })
  assert.deepEqual(parseQuick('Buy milk', projects, today), { title: 'Buy milk' })
  assert.equal(parseQuick('Gym on monday', projects, today).due, '2026-11-02')
  assert.equal(parseQuick('Review at 14:30', projects, today).when, '2026-10-29')
  assert.equal(parseQuick('12am party', [], today).start, '00:00')
  assert.equal(parseQuick('Fix #unknown bug', projects, today).title, 'Fix bug #unknown') // unknown project tags stay in the title
  assert.equal(parseQuick('tomorrow', [], today).title, 'tomorrow') // nothing left: keep the text
})

const WED = new Date(2026, 10, 4, 12)

test('parseQuick reads day and month in either order, next time it comes round', () => {
  assert.deepEqual(parseQuick('IELTS 12 Nov', [], WED), { title: 'IELTS', due: '2026-11-12' })
  assert.deepEqual(parseQuick('IELTS Nov 12', [], WED), { title: 'IELTS', due: '2026-11-12' })
  assert.deepEqual(parseQuick('IELTS 3 March', [], WED), { title: 'IELTS', due: '2027-03-03' })
})

test('parseQuick reads whole weekday names, and leaves words that only start like one', () => {
  assert.equal(parseQuick('Statics midterm wed', [], WED).due, '2026-11-04')
  assert.equal(parseQuick('Statics midterm friday', [], WED).due, '2026-11-06')
  for (const title of ['Save money', 'Fix the monitor', 'Read about Saturn', 'Buy sunscreen', 'Wash fridge', 'Learn thumb rule']) assert.deepEqual(parseQuick(title, [], WED), { title })
})

test('quick dates land at the end of this week or next, weeks starting Monday', () => {
  assert.equal(quickDate('today', WED), '2026-11-04')
  assert.equal(quickDate('tomorrow', WED), '2026-11-05')
  assert.equal(quickDate('thisWeek', WED), '2026-11-08')
  assert.equal(quickDate('nextWeek', WED), '2026-11-15')
  assert.equal(quickDate('thisWeek', new Date(2026, 10, 8, 12)), '2026-11-15') // tapped on a Sunday, it means next Sunday
  assert.equal(quickDate('nextWeek', new Date(2026, 10, 8, 12)), '2026-11-22')
  assert.equal(quickDate('thisWeek', new Date(2026, 10, 7, 12)), '2026-11-08') // on the Saturday, tomorrow
})

test('items proposed by chat are checked before they can be added', () => {
  const out = validAdds([
    { type: 'project', title: ' Statics midterm ', due: '2026-11-04' }, { type: 'task', title: 'Gym', due: 'tomorrow' }, { type: 'task', title: 'Call', due: null },
    { type: 'event', title: 'Nope' }, { type: 'task', title: '' }, { type: 'task' }, null, 'x', { type: 'task', title: 'y'.repeat(500) },
  ])
  assert.deepEqual(out.slice(0, 3), [{ type: 'project', title: 'Statics midterm', due: '2026-11-04' }, { type: 'task', title: 'Gym' }, { type: 'task', title: 'Call' }])
  assert.equal(out.length, 4)
  assert.equal(out[3].title.length, 200)
  assert.deepEqual(validAdds('nonsense'), [])
  assert.equal(validAdds(Array(99).fill({ type: 'task', title: 'x' })).length, 40)
})

test('a date being typed is not real until its year is', () => {
  assert.equal(isRealDate('0002-11-03'), false)
  assert.equal(isRealDate('0202-11-03'), false)
  assert.equal(isRealDate('2026-11-03'), true)
  assert.equal(isRealDate(''), false)
})
