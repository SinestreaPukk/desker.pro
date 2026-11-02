import { chip } from '../ui.js'

const STEPS = [0, 1, 2, 3, 4, 5]

// The one progress scale. `dark` is for the toast.
export function ProgressChips({ value, onPick, dark }) {
  const cls = (on) => (dark
    ? `chip h-11 w-11 shrink-0 rounded-full border text-sm ${on ? 'border-primary bg-primary font-medium text-ink' : 'border-white/30 text-white hover:bg-white/10'}`
    : `${chip(on)} w-11 shrink-0 !px-0`)
  return (
    <span role="group" aria-label="Progress, 0 is not started and 5 is finished" className="flex flex-wrap gap-1">
      {STEPS.map((n) => <button key={n} type="button" className={cls(value === n)} aria-pressed={value === n} onClick={() => onPick(n)}>{n}</button>)}
    </span>
  )
}

export function ProgressBar({ value = 0 }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`Progress ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-2 w-4 rounded-sm ${n <= value ? 'bg-accent' : 'bg-pale'}`} />)}
    </span>
  )
}
