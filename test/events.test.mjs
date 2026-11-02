import test from 'node:test'
import assert from 'node:assert/strict'
import { meetingsOn, addHour, dueOn, taskTime, movedDue, movedMeeting, movedEnd, dropMinutes, meetingToTask, meetingToProject, taskToMeeting, projectAsMeeting, canBeMeeting, typeOf, becomeProject, meetingTimes, repeatsOn } from '../src/events.js'
import { comingUp } from '../src/comingUp.js'
import { rank } from '../src/rank.js'
import { syncSessions } from '../src/sessions.js'

const class2pm = { id: 1, title: 'Statics class', date: '2026-11-02', start: '14:00', end: '15:00', weekly: true } // a Monday
const once = { id: 2, title: 'Advisor', date: '2026-11-03', start: '09:30', end: '10:30' }

test('a one-off meeting shows only on its day', () => {
  assert.deepEqual(meetingsOn('2026-11-03', [once]).map((m) => m.title), ['Advisor'])
  assert.deepEqual(meetingsOn('2026-11-10', [once]), [])
})

test('a weekly meeting repeats on its weekday from its first day on', () => {
  assert.equal(meetingsOn('2026-11-02', [class2pm]).length, 1)
  assert.equal(meetingsOn('2026-11-09', [class2pm]).length, 1)
  assert.equal(meetingsOn('2027-02-01', [class2pm]).length, 1)
  assert.equal(meetingsOn('2026-11-03', [class2pm]).length, 0)
  assert.equal(meetingsOn('2026-10-26', [class2pm]).length, 0) // before it started
})

test('a meeting gives its times in minutes and keeps its source for editing', () => {
  const [m] = meetingsOn('2026-11-09', [class2pm])
  assert.deepEqual([m.s, m.e, m.imported, m.source], [840, 900, false, class2pm])
})

test('imported events merge in, sorted by time, and cannot be edited', () => {
  const s = new Date(2026, 10, 3, 8).getTime(), e = new Date(2026, 10, 3, 9).getTime()
  const out = meetingsOn('2026-11-03', [once], [{ t: 'Gym class', s, e }, { t: 'Holiday', d: '2026-11-03' }, { t: 'Other day', d: '2026-11-04' }])
  assert.deepEqual(out.map((m) => m.title), ['Holiday', 'Gym class', 'Advisor'])
  assert.deepEqual(out.map((m) => m.imported), [true, true, false])
  assert.equal(out[0].allDay, true)
  assert.deepEqual([out[1].s, out[1].e], [480, 540])
})

test('an imported event running past midnight ends at the end of its first day', () => {
  const s = new Date(2026, 10, 3, 23).getTime(), e = new Date(2026, 10, 4, 1).getTime()
  const [m] = meetingsOn('2026-11-03', [], [{ t: 'Late', s, e }])
  assert.deepEqual([m.s, m.e], [1380, 1440])
})

test('a meeting lasts an hour by default, stopping at midnight', () => {
  assert.equal(addHour('14:00'), '15:00')
  assert.equal(addHour('09:30'), '10:30')
  assert.equal(addHour('23:30'), '23:59')
})

const NOW = new Date(2026, 10, 2, 12).getTime() // Monday 2 Nov, noon

test('coming up groups meetings and due dates by day, then Later, and leaves sessions out', () => {
  const groups = comingUp({
    tasks: [
      { id: 1, title: 'Pay rent', due: '2026-11-02' }, { id: 2, title: 'Late fee', due: '2026-10-30' }, { id: 3, title: 'Call bank', due: '2026-11-06' },
      { id: 4, title: 'Finished', due: '2026-11-03', done: true }, { id: 5, title: 'Review', projectId: 9, session: true }, { id: 6, title: 'Climbing', due: '2026-11-03', fun: true },
    ],
    projects: [{ id: 9, title: 'Statics midterm', date: '2026-11-04', progress: 2 }, { id: 10, title: 'IELTS', date: '2026-11-18' }, { id: 11, title: 'Done early', date: '2026-11-05', progress: 5 }, { id: 12, title: 'Past', date: '2026-10-01', progress: 5 }],
    events: [{ id: 1, title: 'Statics class', date: '2026-11-02', start: '14:00', end: '15:00', weekly: true }, { id: 2, title: 'Morning', date: '2026-11-02', start: '08:00', end: '09:00' }],
  }, NOW)
  assert.deepEqual(groups.map((g) => g.name), ['Today', 'Wed 4 Nov', 'Thu 5 Nov', 'Fri 6 Nov', 'Later'])
  assert.deepEqual(groups[0].items.map((x) => x.label), ['Statics class, 2pm–3pm', 'Late fee', 'Pay rent']) // the morning meeting has ended
  assert.deepEqual(groups[1].items.map((x) => x.label), ['Statics midterm'])
  assert.deepEqual(groups[2].items.map((x) => x.label), ['Done early']) // stays until its date passes
  assert.deepEqual(groups[4].items.map((x) => x.label), ['Statics class, 9 Nov', 'IELTS, 18 Nov']) // a repeating class shows once, at its next time
})

test('every calendar item is in coming up, and each says which kind it is', () => {
  const groups = comingUp({ tasks: [{ id: 1, title: 'Pay rent', due: '2026-11-03' }], projects: [], events: [{ id: 1, title: 'Advisor', date: '2026-11-03', start: '14:00', end: '15:00' }, { id: 2, title: 'Far off', date: '2026-12-01', start: '09:00', end: '10:00' }] }, NOW)
  assert.deepEqual(groups.map((g) => g.name), ['Tue 3 Nov', 'Later'])
  assert.deepEqual(groups[0].items.map((x) => [x.label, x.kind]), [['Advisor, 2pm–3pm', 'meeting'], ['Pay rent', 'due']])
  assert.deepEqual(groups[1].items.map((x) => [x.label, x.kind]), [['Far off, 1 Dec', 'meeting']])
})

test('an imported calendar stays readable: a repeating event shows once under Later', () => {
  const at = (d, h) => new Date(2026, 10, d, h).getTime()
  const busy = [10, 12, 17].map((d) => ({ t: 'Lab', s: at(d, 9), e: at(d, 10) }))
  const [later] = comingUp({ tasks: [], projects: [], busy }, NOW)
  assert.deepEqual(later.items.map((x) => x.label), ['Lab, 10 Nov'])
})

test('anything with a due date sits on the calendar, like a reminder', () => {
  const tasks = [
    { id: 1, title: 'Pay rent', due: '2026-11-03' }, { id: 2, title: 'Call dentist', due: '2026-11-03', when: '2026-11-03', start: '15:00' },
    { id: 3, title: 'Done', due: '2026-11-03', done: true }, { id: 4, title: 'Fun', due: '2026-11-03', fun: true }, { id: 5, title: 'Other day', due: '2026-11-04' }, { id: 6, title: 'No date' },
    { id: 7, title: 'Review', projectId: 9, session: true },
  ]
  const projects = [{ id: 9, title: 'Midterm', date: '2026-11-03', time: '10:00' }, { id: 10, title: 'Essay', date: '2026-11-03', progress: 5 }, { id: 11, title: 'No date project' }]
  const out = dueOn('2026-11-03', tasks, projects)
  assert.deepEqual(out.map((x) => x.title), ['Pay rent', 'Essay', 'Midterm', 'Call dentist'])
  assert.equal(out[0].allDay, true)
  assert.deepEqual([out[2].s, out[2].e, out[2].project.id], [600, 630, 9])
  assert.deepEqual([out[3].s, out[3].task.id], [900, 2])
})

test('a project past its date and finished leaves the calendar, one past due and unfinished stays', () => {
  const projects = [{ id: 1, title: 'Old', date: '2026-10-01', progress: 5 }, { id: 2, title: 'Missed', date: '2026-10-01', progress: 2 }]
  assert.deepEqual(dueOn('2026-10-01', [], projects, '2026-11-02').map((x) => x.title), ['Missed'])
})

test('setting a task time keeps it on that day, and clearing it makes it whole-day again', () => {
  assert.deepEqual(taskTime('2026-11-03', '15:00'), { when: '2026-11-03', start: '15:00', time: undefined })
  assert.deepEqual(taskTime('2026-11-03', ''), { when: undefined, start: undefined, time: undefined })
  const task = { id: 1, title: 'Fee', due: '2026-11-03', time: '09:00', ...taskTime('2026-11-03', '15:00') }
  assert.equal(dueOn('2026-11-03', [task], [])[0].s, 900) // a time from an old deadline gives way
})

test('dragging a task or project to a slot sets its day and time, and to the all-day row clears the time', () => {
  const task = { id: 1, title: 'Fee', due: '2026-11-03' }
  assert.deepEqual(movedDue({ task }, '2026-11-05', '14:30'), { due: '2026-11-05', when: '2026-11-05', start: '14:30', time: undefined })
  assert.deepEqual(movedDue({ task }, '2026-11-05', ''), { due: '2026-11-05', when: undefined, start: undefined, time: undefined })
  const project = { id: 2, title: 'Statics test', date: '2026-11-03' }
  assert.deepEqual(movedDue({ project }, '2026-11-05', '14:30'), { date: '2026-11-05', time: '14:30' })
  assert.deepEqual(movedDue({ project }, '2026-11-05', ''), { date: '2026-11-05', time: undefined })
})

test('dragging a meeting keeps how long it is, stopping at midnight', () => {
  const e = { id: 1, title: 'Lab', date: '2026-11-03', start: '14:00', end: '15:30', weekly: true }
  assert.deepEqual(movedMeeting(e, '2026-11-04', '09:00'), { ...e, date: '2026-11-04', start: '09:00', end: '10:30' })
  assert.equal(movedMeeting(e, '2026-11-04', '23:00').end, '23:59')
})

test('a drop lands on the half hour it is over, inside the hours shown', () => {
  assert.equal(dropMinutes(0, 44, 6, 23), 360)
  assert.equal(dropMinutes(21, 44, 6, 23), 360)
  assert.equal(dropMinutes(23, 44, 6, 23), 390)
  assert.equal(dropMinutes(44 * 8 + 1, 44, 6, 23), 840)
  assert.equal(dropMinutes(99999, 44, 6, 23), 1350)
  assert.equal(dropMinutes(-5, 44, 6, 23), 360)
})

test('a meeting switched to a reminder keeps its title, day and time, and a weekly one repeats', () => {
  const e = { id: 5, title: 'Pay rent', date: '2026-11-03', start: '14:00', end: '15:00' }
  assert.deepEqual(meetingToTask(e), { type: 'task', title: 'Pay rent', due: '2026-11-03', when: '2026-11-03', start: '14:00' })
  assert.equal(meetingToTask({ ...e, weekly: true }).repeat, 'weekly')
  const [row] = dueOn('2026-11-03', [{ id: 1, ...meetingToTask(e) }], [])
  assert.equal(row.s, 840)
})

test('a reminder switched to a meeting starts as a draft with its title, day and time', () => {
  const t = { id: 1, title: 'Advisor', due: '2026-11-03', when: '2026-11-03', start: '14:00' }
  assert.deepEqual(taskToMeeting(t), { title: 'Advisor', date: '2026-11-03', start: '14:00', end: '15:00' })
  assert.equal(taskToMeeting({ ...t, repeat: 'weekly' }).weekly, true)
  assert.equal(taskToMeeting({ id: 2, title: 'Old', due: '2026-11-03', time: '10:00' }).start, '10:00')
  assert.equal(taskToMeeting({ id: 3, title: 'All day', due: '2026-11-03' }).start, '09:00') // reminders treat 9am as the start of the day too
})

test('a task with a due date can become a meeting, unless its repeat is one a meeting cannot do', () => {
  assert.equal(canBeMeeting({ due: '2026-11-03' }), true)
  assert.equal(canBeMeeting({ due: '2026-11-03', repeat: 'weekly' }), true)
  assert.equal(canBeMeeting({ due: '2026-11-03', projectId: 1, goalId: 2 }), true)
  assert.equal(canBeMeeting({}), false)
  assert.equal(canBeMeeting({ due: '2026-11-03', repeat: 'daily' }), false)
})

const statics = { id: 9, title: 'Statics test', date: '2026-11-03', time: '10:00', end: '12:00', progress: 2, goalId: 1 }

test('a project meeting fills its slot from start to end on the calendar', () => {
  const [row] = dueOn('2026-11-03', [], [statics])
  assert.deepEqual([row.s, row.e, row.project.id], [600, 720, 9])
  const { end, ...reminder } = statics
  assert.equal(dueOn('2026-11-03', [], [reminder])[0].e, 630) // a reminder stays one small mark at its time
})

test('a project meeting whose end is not after its start stays a small mark until it is fixed', () => {
  assert.equal(dueOn('2026-11-03', [], [{ ...statics, end: '09:00' }])[0].e, 630)
})

test('switching a project to a meeting only adds an end, so it keeps working as a project', () => {
  const { end, ...reminder } = statics
  assert.deepEqual(projectAsMeeting(reminder), { time: '10:00', end: '11:00' })
  assert.deepEqual(projectAsMeeting({ id: 1, title: 'All day', date: '2026-11-03' }), { time: '09:00', end: '10:00' }) // reminders treat 9am as the start of the day too
  const [row] = rank({ goals: [{ id: 1, title: 'Pass', level: 3 }], projects: [statics], tasks: syncSessions([], [statics], new Date(2026, 10, 2, 12).getTime()) })
  assert.equal(row.task.session, true)
  assert.equal(row.task.projectId, 9)
})

test('dragging a project meeting keeps how long it is', () => {
  assert.deepEqual(movedDue({ project: statics }, '2026-11-05', '14:30'), { date: '2026-11-05', time: '14:30', end: '16:30' })
})

test('moving the start of a meeting keeps how long it is, stopping at midnight', () => {
  assert.equal(movedEnd('10:00', '12:00', '13:00'), '15:00')
  assert.equal(movedEnd('10:00', '12:00', '23:00'), '23:59')
})

test('a goal stays on a task through switching to a meeting and back', () => {
  const t = { id: 1, title: 'Lab', due: '2026-11-03', when: '2026-11-03', start: '14:00', goalId: 4 }
  const m = taskToMeeting(t)
  assert.equal(m.goalId, 4)
  assert.equal(meetingToTask(m).goalId, 4)
})

test('a new project from the calendar is a reminder or a meeting, with its goal', () => {
  const x = { title: 'Statics test', date: '2026-11-03', start: '10:00', end: '12:00', goalId: 4, weekly: true }
  assert.deepEqual(meetingToProject(x, 'Meeting'), { type: 'project', title: 'Statics test', due: '2026-11-03', time: '10:00', end: '12:00', goalId: 4 })
  assert.deepEqual(meetingToProject({ ...x, goalId: undefined }, 'Reminder'), { type: 'project', title: 'Statics test', due: '2026-11-03', time: '10:00' })
})

test('everything on the calendar is one of five types', () => {
  const { end, ...reminder } = statics
  const [own, imported] = meetingsOn('2026-11-03', [once], [{ t: 'Holiday', d: '2026-11-03' }]).reverse()
  assert.equal(typeOf(own), 'taskMeeting')
  assert.equal(typeOf(imported), 'imported')
  assert.equal(typeOf({ task: { id: 1 } }), 'taskReminder')
  assert.equal(typeOf({ project: reminder }), 'projectReminder')
  assert.equal(typeOf({ project: statics }), 'projectMeeting')
})

test('coming up shows times, sorted through the day, and says each type', () => {
  const groups = comingUp({
    tasks: [{ id: 1, title: 'Pay rent', due: '2026-11-03', when: '2026-11-03', start: '14:00' }, { id: 2, title: 'Fee', due: '2026-11-03' }],
    projects: [statics],
    events: [{ id: 1, title: 'Statics class', date: '2026-11-03', start: '16:00', end: '17:30' }],
    busy: [{ t: 'Holiday', d: '2026-11-03' }],
  }, NOW)
  assert.deepEqual(groups[0].items.map((x) => [x.label, x.type]), [
    ['Holiday', 'imported'], ['Statics test, 10am–12pm', 'projectMeeting'], ['Pay rent, 2pm', 'taskReminder'], ['Statics class, 4pm–5:30pm', 'taskMeeting'], ['Fee', 'taskReminder'],
  ])
})

test('under Later each item still says its type', () => {
  const [later] = comingUp({ tasks: [], projects: [{ ...statics, date: '2026-12-01' }], events: [{ id: 1, title: 'Far', date: '2026-12-02', start: '09:00', end: '10:00' }], busy: [{ t: 'Trip', d: '2026-12-03' }] }, NOW)
  assert.deepEqual(later.items.map((x) => x.type), ['projectMeeting', 'taskMeeting', 'imported'])
})

test('a task meeting becomes a project with its title, day, times and goal, and stops being a meeting', () => {
  const e = { id: 5, title: 'Static test', date: '2026-11-02', start: '12:30', end: '16:00', goalId: 4 }
  const d = becomeProject({ tasks: [], projects: [{ id: 1, title: 'Other' }], events: [e, once] }, { event: 5 }, e, 'Meeting', 77)
  assert.deepEqual(d.events, [once])
  assert.deepEqual(d.projects[1], { id: 77, title: 'Static test', date: '2026-11-02', time: '12:30', end: '16:00', goalId: 4 })
  assert.equal(syncSessions(d.tasks, d.projects, NOW).find((t) => t.projectId === 77).title, 'Review for Static test') // now it gets sessions
})

test('a weekly task meeting that becomes a project drops its repeat, as a project has one date', () => {
  const e = { id: 5, title: 'Lab', date: '2026-11-02', start: '12:30', end: '16:00', weekly: true }
  const d = becomeProject({ tasks: [], projects: [], events: [e] }, { event: 5 }, e, 'Meeting', 77)
  assert.equal('weekly' in d.projects[0], false)
})

test('a task reminder becomes a project reminder, and the task is gone from the list', () => {
  const keep = { id: 2, title: 'Keep' }, t = { id: 1, title: 'Essay', due: '2026-11-05', when: '2026-11-05', start: '15:00', goalId: 4 }
  const d = becomeProject({ tasks: [t, keep], projects: [], events: [] }, { task: 1 }, taskToMeeting(t), 'Reminder', 77)
  assert.deepEqual(d.tasks, [keep])
  assert.deepEqual(d.projects, [{ id: 77, title: 'Essay', date: '2026-11-05', time: '15:00', goalId: 4 }])
})

test('a new project id never clashes with one already there', () => {
  const e = { id: 5, title: 'Lab', date: '2026-11-02', start: '12:30', end: '16:00' }
  const far = Date.now() + 1e6
  const d = becomeProject({ tasks: [], projects: [{ id: far, title: 'Other' }], events: [e] }, { event: 5 }, e, 'Meeting')
  assert.equal(d.projects[1].id, far + 1)
})

test('a meeting always ends up with a start and a later end', () => {
  assert.deepEqual(meetingTimes('10:00', '12:00'), { time: '10:00', end: '12:00' })
  assert.deepEqual(meetingTimes('10:00'), { time: '10:00', end: '11:00' })
  assert.deepEqual(meetingTimes('10:00', '09:00'), { time: '10:00', end: '11:00' }) // an end before the start gives way
  assert.deepEqual(meetingTimes(''), { time: '09:00', end: '10:00' }) // reminders treat 9am as the start of the day too
})

test('with no deadline, a task and a project have no date or time at all', () => {
  const x = { title: 'Read more', date: '', start: '', end: '', goalId: 4 }
  assert.deepEqual(meetingToTask(x), { type: 'task', title: 'Read more', goalId: 4 })
  assert.deepEqual(meetingToProject(x, 'Reminder'), { type: 'project', title: 'Read more', goalId: 4 })
})

test('a date with no time is a whole-day reminder', () => {
  const x = { title: 'Pay rent', date: '2026-11-03', start: '', end: '' }
  assert.deepEqual(meetingToTask(x), { type: 'task', title: 'Pay rent', due: '2026-11-03' })
  assert.deepEqual(meetingToProject(x, 'Reminder'), { type: 'project', title: 'Pay rent', due: '2026-11-03' })
  assert.equal(dueOn('2026-11-03', [{ id: 1, ...meetingToTask(x) }], [])[0].allDay, true)
})

test('a task reminder can belong to a project picked in its title', () => {
  assert.equal(meetingToTask({ title: 'Call', date: '', start: '', projectId: 3 }).projectId, 3)
})

const hw = { id: 1, title: 'Linear HW', due: '2026-11-05', when: '2026-11-05', start: '08:30', repeat: 'weekly' } // a Thursday

test('a weekly task repeats on its weekday after its due date, and never before', () => {
  assert.equal(repeatsOn(hw, '2026-11-12'), true)
  assert.equal(repeatsOn(hw, '2027-01-07'), true)
  assert.equal(repeatsOn(hw, '2026-11-13'), false)
  assert.equal(repeatsOn(hw, '2026-11-05'), false) // that is the real one
  assert.equal(repeatsOn(hw, '2026-10-29'), false)
  assert.equal(repeatsOn({ ...hw, repeat: undefined }, '2026-11-12'), false)
  assert.equal(repeatsOn({ ...hw, due: undefined }, '2026-11-12'), false)
})

test('daily, weekday and monthly tasks repeat on the right days', () => {
  assert.equal(repeatsOn({ due: '2026-11-05', repeat: 'daily' }, '2026-11-06'), true)
  assert.equal(repeatsOn({ due: '2026-11-05', repeat: 'weekdays' }, '2026-11-06'), true) // Friday
  assert.equal(repeatsOn({ due: '2026-11-05', repeat: 'weekdays' }, '2026-11-07'), false) // Saturday
  assert.equal(repeatsOn({ due: '2026-11-05', repeat: 'monthly' }, '2026-12-05'), true)
  assert.equal(repeatsOn({ due: '2026-11-05', repeat: 'monthly' }, '2026-12-06'), false)
  assert.equal(repeatsOn({ due: '2026-10-31', repeat: 'monthly' }, '2026-11-30'), true) // a short month uses its last day
  assert.equal(repeatsOn({ due: '2026-10-31', repeat: 'monthly' }, '2026-11-29'), false)
})

test('a repeating task shows on later dates at its time, marked as a later one', () => {
  const [later] = dueOn('2026-11-12', [hw], [])
  assert.deepEqual([later.title, later.s, later.future, later.task.id], ['Linear HW', 510, true, 1])
  assert.equal(dueOn('2026-11-05', [hw], [])[0].future, undefined)
  assert.deepEqual(dueOn('2026-11-12', [{ ...hw, done: true }], []), [])
})

test('coming up shows a repeating task each time in the next days, then once under Later', () => {
  const groups = comingUp({ tasks: [hw, { id: 2, title: 'Vitamins', due: '2026-11-03', repeat: 'daily' }], projects: [], events: [] }, NOW)
  const thu = groups.find((g) => g.name === 'Thu 5 Nov')
  assert.deepEqual(thu.items.map((x) => x.label), ['Linear HW, 8:30am', 'Vitamins'])
  assert.equal(groups.find((g) => g.name === 'Wed 4 Nov').items[0].label, 'Vitamins')
  assert.deepEqual(groups.at(-1).items.map((x) => x.label), ['Vitamins, 9 Nov', 'Linear HW, 12 Nov'])
})

test('a repeating task that starts past the next days shows once under Later', () => {
  const [later] = comingUp({ tasks: [{ ...hw, due: '2026-12-03', when: '2026-12-03' }], projects: [], events: [] }, NOW)
  assert.deepEqual(later.items.map((x) => x.label), ['Linear HW, 3 Dec'])
})
