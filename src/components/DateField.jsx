import { fmtDay } from '../shared.jsx'

// A date input that always reads the same way ("Today", "Tomorrow", "Sat, Oct 31") instead of the browser's 31/10/2026.
// The real <input type="date"> sits invisibly on top, so the native picker, keyboard and screen readers all still work.
export default function DateField({ className = '', value, ...rest }) {
  return (
    <span className={`px-datefield relative inline-flex items-center ${className}`}>
      <span aria-hidden="true" className="pointer-events-none truncate">{value ? fmtDay(value) : <span className="text-yoru-0">Pick a date</span>}</span>
      <input type="date" value={value} {...rest} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onClick={(e) => e.currentTarget.showPicker?.()} />
    </span>
  )
}
