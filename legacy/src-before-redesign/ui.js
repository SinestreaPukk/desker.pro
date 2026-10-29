// Shared class names. Achromatic ledger: near-black primary, flat 1px-bordered surfaces, a coloured edge only on quadrant data.
export const BLUE = 'border border-[#93b1e6] bg-primary text-ink hover:bg-primary-hover' // name kept: the primary action
export const btn = 'rounded-lg px-4 py-2 text-sm font-medium transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-60'
export const input = 'rounded-lg border border-control bg-white px-3 py-2 placeholder:text-slate-500'

const card = 'border border-line'
export const Q = [
  { name: 'Do First', hint: 'Urgent + Important', cls: `${card} bg-[#fdf1ee]`, dot: 'bg-[#e8a598]' },
  { name: 'Schedule', hint: 'Not Urgent + Important', cls: `${card} bg-[#eef3fd]`, dot: 'bg-[#7fa3e0]' },
  { name: 'Batch / minimize', hint: 'Urgent + Not Important', cls: `${card} bg-[#fbf5e6]`, dot: 'bg-[#dcc084]' },
  { name: 'Eliminate', hint: 'Not Urgent + Not Important', cls: `${card} bg-[#f1f3f8]`, dot: 'bg-[#a9b4cb]' },
]
// Goals pyramid, narrowest (top) to widest (base): a pastel-blue ladder, deeper toward the near term
export const LEVELS = [
  { name: 'Vision', hint: 'Life purpose / who you want to be', w: 'md:w-1/3', cls: 'border border-[#e3ebfa] bg-[#f3f7fe]' },
  { name: 'Long-term', hint: '5+ years', w: 'md:w-1/2', cls: 'border border-[#d6e2f7] bg-[#e6eefb]' },
  { name: 'Mid-term', hint: '1-3 years', w: 'md:w-3/4', cls: 'border border-[#c5d6f3] bg-[#d3e0f6]' },
  { name: 'Short-term', hint: 'This quarter', w: 'md:w-full', cls: 'border border-[#a9c1ec] bg-[#b4caf0]' },
]
