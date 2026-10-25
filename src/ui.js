// Shared class names.
export const BLUE = 'bg-[#007aff] text-white hover:bg-[#0a84ff]'
export const btn = 'rounded-full px-4 py-2 text-sm font-medium transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50'
export const input = 'rounded-xl bg-slate-100 px-3 py-2 placeholder:text-slate-600'

export const Q = [
  { name: 'Do First', hint: 'Urgent + Important', cls: 'bg-[#ff3b30]/15' },
  { name: 'Schedule', hint: 'Not Urgent + Important', cls: 'bg-[#007aff]/15' },
  { name: 'Batch / minimize', hint: 'Urgent but not important: do quickly in one batch, or hand off', cls: 'bg-[#ff9500]/20' },
  { name: 'Eliminate', hint: 'Not Urgent + Not Important', cls: 'bg-[#8e8e93]/15' },
]
// Goals pyramid, narrowest (top) to widest (base)
export const LEVELS = [
  { name: 'Vision', hint: 'Life purpose / who you want to be', w: 'w-1/3', cls: 'bg-[#af52de]/20' },
  { name: 'Long-term', hint: '5+ years', w: 'w-1/2', cls: 'bg-[#5856d6]/20' },
  { name: 'Mid-term', hint: '1-3 years', w: 'w-3/4', cls: 'bg-[#007aff]/20' },
  { name: 'Short-term', hint: 'This quarter', w: 'w-full', cls: 'bg-[#5ac8fa]/25' },
]
