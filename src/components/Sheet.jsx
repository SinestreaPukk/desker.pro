import { useEffect, useRef } from 'react'
import { btn } from '../ui.js'

// The side sheet: full width on phones, a right-hand panel on desktop. Esc or a tap outside closes it.
export default function Sheet({ label, onClose, children }) {
  const panel = useRef(null)
  useEffect(() => {
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus() // a child's autoFocus keeps its place
    const f = (e) => e.key === 'Escape' && onClose()
    addEventListener('keydown', f)
    return () => removeEventListener('keydown', f)
  }, [])
  return (
    <>
      <div className="fixed inset-0 z-30 hidden bg-ink/20 sm:block" onClick={onClose} aria-hidden="true" />
      <aside ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label}
        className="sheet fixed inset-y-0 right-0 z-30 w-full space-y-5 overflow-y-auto bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none sm:w-[26rem] sm:border-l sm:border-line">
        <div className="flex justify-end"><button className={`${btn} text-accent hover:bg-pale`} onClick={onClose}>Close</button></div>
        {children}
      </aside>
    </>
  )
}

export const Field = ({ label, children }) => (
  <div>
    <p className="mb-2 text-sm font-medium">{label}</p>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
)
