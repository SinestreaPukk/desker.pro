// Shared class names. Desker is soft: pill buttons, 20px tonal panels, 14px row cards, one pastel-blue action.
export const BLUE = 'bg-primary text-ink hover:bg-primary-hover'
export const btn = 'rounded-full px-4 py-2 text-sm font-medium transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-60'
export const ghost = 'border border-control bg-white hover:bg-slate-100'
export const input = 'rounded-xl border border-control bg-white px-3 py-2 placeholder:text-slate-500'
export const panel = 'rounded-2xl bg-panel p-5'
export const rowCard = 'rounded-xl border border-line bg-white'

// every task matters, just not equally: the four boxes rank by impact and timing, none means 'drop it'
// the matrix: another view of the ranking, with a tint for each box
export const Q = [
  { name: 'Do First', hint: 'Due soon, high impact', cls: 'border border-line bg-[#fdf1ee]', dot: 'bg-[#e8a598]' },
  { name: 'Schedule', hint: 'High impact, not due yet', cls: 'border border-line bg-[#eaf0fc]', dot: 'bg-[#7fa3e0]' },
  { name: 'Fit it in', hint: 'Due soon, lighter impact', cls: 'border border-line bg-[#fbf5e6]', dot: 'bg-[#dcc084]' },
  { name: 'Later', hint: 'Lighter impact, no rush', cls: 'border border-line bg-[#f1f3f8]', dot: 'bg-[#a9b4cb]' },
]
// What each kind of calendar item looks like. Blue is a task and violet a project; an outline is a reminder and a fill is a meeting.
// cls colours a block, ring colours its tick, and mark is the small sign in Coming up and the legend.
export const TYPES = {
  taskReminder: { name: 'Task reminder', cls: 'border-primary-hover bg-white text-ink', ring: 'border-accent', mark: 'rounded-full border border-accent' },
  taskMeeting: { name: 'Class or meeting', cls: 'border-primary-hover bg-pale text-ink', mark: 'rounded-sm bg-accent' },
  projectReminder: { name: 'Project reminder', cls: 'border-project-line bg-white text-ink', ring: 'border-project', mark: 'rounded-full border border-project' },
  projectMeeting: { name: 'Project meeting', cls: 'border-project-line bg-project-pale text-ink', ring: 'border-project', mark: 'rounded-sm bg-project' },
  imported: { name: 'From your calendar', cls: 'border-control bg-stone/20 text-slate-700', mark: 'rounded-sm bg-stone' },
}
// A tap choice: follow-up questions, areas, goals.
export const chip = (on) => `chip min-h-11 rounded-full border px-4 py-2 text-sm transition ${on ? 'border-accent bg-pale text-ink' : 'border-control bg-white text-slate-700 hover:bg-pale'}`
