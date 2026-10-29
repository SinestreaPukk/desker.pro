// Shared class names. Desker is soft: pill buttons, 20px tonal panels, 14px row cards, one pastel-blue action.
export const BLUE = 'bg-primary text-ink hover:bg-primary-hover'
export const btn = 'rounded-full px-4 py-2 text-sm font-medium transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-60'
export const ghost = 'border border-control bg-white hover:bg-slate-100'
export const input = 'rounded-xl border border-control bg-white px-3 py-2 placeholder:text-slate-500'
export const panel = 'rounded-2xl bg-panel p-5'
export const rowCard = 'rounded-xl border border-line bg-white'

// quadrant tint + dot colour; the tint is used on chips in the calendar too
export const Q = [
  { name: 'Do First', hint: 'Urgent and important', cls: 'border border-line bg-[#fdf1ee]', dot: 'bg-[#e8a598]' },
  { name: 'Schedule', hint: 'Important, not urgent', cls: 'border border-line bg-[#eaf0fc]', dot: 'bg-[#7fa3e0]' },
  { name: 'Batch / minimize', hint: 'Urgent, not important', cls: 'border border-line bg-[#fbf5e6]', dot: 'bg-[#dcc084]' },
  { name: 'Eliminate', hint: 'Neither', cls: 'border border-line bg-[#f1f3f8]', dot: 'bg-[#a9b4cb]' },
]
// Goals pyramid, narrowest (top) to widest (base): a pastel-blue ladder, deeper toward the near term
export const LEVELS = [
  { name: 'Vision', hint: 'Life purpose / who you want to be', w: 'md:w-1/3', cls: 'bg-[#f3f7fe]' },
  { name: 'Long-term', hint: '5+ years', w: 'md:w-1/2', cls: 'bg-[#e6eefb]' },
  { name: 'Mid-term', hint: '1-3 years', w: 'md:w-3/4', cls: 'bg-[#d3e0f6]' },
  { name: 'Short-term', hint: 'This quarter', w: 'md:w-full', cls: 'bg-[#b4caf0]' },
]
