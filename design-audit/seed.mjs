// Seeded workspace for audits: built relative to "now" so dates always make sense.
const d = (n) => new Date(Date.now() + n * 864e5).toLocaleDateString('sv')
const at = (n, h = 10) => { const x = new Date(Date.now() + n * 864e5); x.setHours(h, 0, 0, 0); return x.getTime() }
export const seed = () => ({
  goals: [
    { id: 1, title: 'Become a doctor who helps rural communities', level: 0 },
    { id: 2, title: 'Finish medical school with honours', level: 1 },
    { id: 3, title: 'Get into a top MD programme', level: 2 },
    { id: 4, title: 'Pass Cell Biology midterm', level: 3 },
    { id: 5, title: 'Run a 10k', level: 3, happiness: true },
  ],
  hobbies: [{ id: 11, title: 'Sketch at the café' }, { id: 12, title: 'Call grandma' }],
  deadlines: [{ id: 21, title: 'Cell Bio midterm', date: d(4), hours: 10 }, { id: 22, title: 'Scholarship essay', date: d(12), hours: 6 }],
  tasks: [
    { id: 101, title: 'Review chapters 4-6 of Cell Biology', due: d(2), hours: 1.5, goalId: 4, important: true, urgent: true, reason: 'Midterm in 4 days', done: false, happy: 40 },
    { id: 102, title: 'Email professor about research lab', due: d(6), hours: 0.5, goalId: 3, important: true, urgent: false, done: false, happy: 60 },
    { id: 103, title: 'Book dentist', due: d(1), hours: 0.25, important: false, urgent: true, done: false, happy: 30 },
    { id: 104, title: 'Reorganise notes folder', hours: 0.75, important: false, urgent: false, done: false, happy: 50 },
    { id: 105, title: 'Past paper: Biochemistry 2023', when: d(-1), hours: 2, goalId: 2, important: true, urgent: false, done: false, happy: 35 },
    { id: 106, title: 'Evening run', fun: true, when: d(0), hours: 0.75, goalId: 5, done: false, happy: 90 },
    { id: 107, title: 'Read lecture slides', hours: 1, goalId: 4, important: true, urgent: false, done: true, doneAt: at(-1), happy: 50 },
    { id: 108, title: 'Flashcards: cell cycle', hours: 0.5, done: true, doneAt: at(0, 8), happy: 50 },
    { id: 109, title: 'Lab report draft', hours: 3, goalId: 2, done: true, doneAt: at(-8), spent: 3, happy: 40 },
    { id: 110, title: 'Group study session', hours: 2, done: true, doneAt: at(-9), happy: 70 },
    { id: 111, title: 'Library research', hours: 1.5, goalId: 3, done: true, doneAt: at(-10), happy: 55 },
    { id: 112, title: 'Gym', fun: true, hours: 1, done: true, doneAt: at(-2), happy: 80 },
  ],
  projects: [], freeHours: 4, energyLog: [],
})
