// Shared class names. Yuki: 9-slice pixel frames (see index.css), flat text buttons, one beni accent.
export const BLUE = 'px-btn-primary'
export const btn = 'px-btn'
export const ghost = 'px-btn-secondary'
export const input = 'px-field'
export const panel = 'px-panel p-4'
export const rowCard = 'px-rule'

// every task matters, just not equally: the four boxes rank by impact and timing, none means 'drop it'
// cls = chip colours (calendar), dot = swatch, tab = panel tab frame. Do First is beni, the only accent.
export const Q = [
  { name: 'Do First', hint: 'Due soon, high impact', cls: 'border border-line bg-beni text-yuki-0', dot: 'bg-beni', tab: 'px-tab-beni' },
  { name: 'Schedule', hint: 'High impact, not due yet', cls: 'border border-line bg-kori-1 text-ink', dot: 'bg-kori-2', tab: 'px-tab-kori' },
  { name: 'Fit it in', hint: 'Due soon, lighter impact', cls: 'border border-line bg-matsu-0 text-ink', dot: 'bg-matsu-1', tab: 'px-tab-matsu' },
  { name: 'Later', hint: 'Lighter impact, no rush', cls: 'border border-line bg-yuki-1 text-ink', dot: 'bg-yuki-3', tab: 'px-tab-yuki' },
]
// Goals pyramid, narrowest (top) to widest (base): a cold ladder, deeper toward the near term
export const LEVELS = [
  { name: 'Vision', hint: 'Life purpose / who you want to be', w: 'md:w-1/3', cls: 'bg-yuki-1' },
  { name: 'Long-term', hint: '5+ years', w: 'md:w-1/2', cls: 'bg-yuki-2' },
  { name: 'Mid-term', hint: '1-3 years', w: 'md:w-3/4', cls: 'bg-kori-1' },
  { name: 'Short-term', hint: 'This quarter', w: 'md:w-full', cls: 'bg-matsu-0' },
]
