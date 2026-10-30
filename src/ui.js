// Shared class names. Desker is soft: pill buttons, 20px tonal panels, 14px row cards, one pastel-blue action.
export const BLUE = 'bg-accent-dark text-white hover:bg-ink' // the one primary action: solid, never looks disabled
export const btn = 'rounded-full px-4 py-2 text-sm font-medium transition cursor-pointer disabled:cursor-not-allowed disabled:border disabled:!bg-slate-100 disabled:!text-slate-500 disabled:!border-slate-200'
export const ghost = 'border border-control bg-white hover:bg-slate-100'
export const input = 'rounded-xl border border-control bg-white px-3 py-2 placeholder:text-slate-500'
export const panel = 'rounded-2xl bg-panel p-5'
export const rowCard = 'rounded-xl border border-line bg-white'

// FIXED COLOUR SET 1: the four Eisenhower boxes. Same tint, dot and name on Today, Tasks, Calendar.
// Importance comes from the goal level a task links to; urgency from its due date. Tint = row/chip background, dot = solid marker (>= 3:1 on white).
export const Q = [
  { name: 'Do First', hint: 'Due soon, high impact', cls: 'border border-line bg-[#fdf1ee]', dot: 'bg-[#c4402f]' },
  { name: 'Schedule', hint: 'High impact, not due yet', cls: 'border border-line bg-[#eaf0fc]', dot: 'bg-[#2f5fb8]' },
  { name: 'Fit it in', hint: 'Due soon, lighter impact', cls: 'border border-line bg-[#fbf5e6]', dot: 'bg-[#9a6a00]' },
  { name: 'Later', hint: 'Lighter impact, no rush', cls: 'border border-line bg-[#f1f3f8]', dot: 'bg-[#5f6b86]' },
]
// FIXED COLOUR SET 2: the goal levels, narrowest (top) to widest (base), plus Fun and No goal.
// color = solid (bars, markers; all >= 4.5:1 on white), cls = tint for panels (ink text on it passes AA).
export const LEVELS = [
  { name: 'Vision', hint: 'Life purpose / who you want to be', w: 'md:w-1/3', cls: 'bg-[#f1e9f8]', color: '#7b3fa0' },
  { name: 'Long-term', hint: '5+ years', w: 'md:w-1/2', cls: 'bg-[#e8e8f8]', color: '#4b4bb8' },
  { name: 'Mid-term', hint: '1-3 years', w: 'md:w-3/4', cls: 'bg-[#e3eef9]', color: '#2563a8' },
  { name: 'Short-term', hint: 'This quarter', w: 'md:w-full', cls: 'bg-[#dff1f1]', color: '#0f7f86' },
]
export const FUN = { name: 'Fun', color: '#2e7d32' }
export const NO_GOAL = { name: 'No goal', color: '#6b7280' }
