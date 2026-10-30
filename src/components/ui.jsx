import { btn, ghost, BLUE, Q, LEVELS } from '../ui.js'

// Shared building blocks. Every page uses these, so one concept looks and is named the same everywhere.
const VARIANT = {
  primary: BLUE,
  secondary: ghost,
  ghost: 'text-accent hover:bg-pale',
  destructive: 'border border-danger bg-white text-danger hover:bg-danger-tint',
}
export const Button = ({ variant = 'primary', className = '', type = 'button', ...p }) => <button type={type} className={`${btn} ${VARIANT[variant]} ${className}`} {...p} />

export const SectionHeader = ({ title, action, id, as: H = 'h2' }) => (
  <div className="flex items-center justify-between gap-3">
    <H id={id} className="text-base font-semibold">{title}</H>
    {action}
  </div>
)

// Titled panel with an optional action in the header corner.
export const Card = ({ title, action, children, className = '', tone = 'bg-panel' }) => {
  const id = title ? `h-${title.replace(/\W+/g, '-').toLowerCase()}` : undefined
  return (
    <section aria-labelledby={id} className={`rounded-2xl ${tone} p-4 md:p-5 ${className}`}>
      {title && <SectionHeader id={id} title={title} action={action} />}
      <div className={title ? 'mt-3' : ''}>{children}</div>
    </section>
  )
}

// label -> big number -> one line of context. `warn` adds a warning icon and danger colour on the context line (never colour alone).
export const StatTile = ({ label, value, context, warn, action }) => (
  <div className="flex min-w-0 flex-col rounded-2xl bg-panel p-4">
    <div className="flex items-start justify-between gap-2"><p className="text-sm text-slate-600">{label}</p>{action}</div>
    <p className="mt-1 text-xl font-medium tabular-nums">{value}</p>
    <p className={`mt-1 text-xs ${warn ? 'font-medium text-danger' : 'text-slate-600'}`}>{warn && <span aria-hidden="true">⚠ </span>}{context}</p>
  </div>
)

export const EmptyState = ({ title, children, action }) => (
  <div className="py-2">
    <p className="font-medium">{title}</p>
    {children && <p className="mt-1 text-sm text-slate-600">{children}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>
)

export const Skeleton = ({ className = '' }) => <div aria-hidden="true" className={`animate-pulse rounded-2xl bg-panel motion-reduce:animate-none ${className}`} />

// "Do First · Short-term: Pass Cell Bio midterm", or an invitation to link a goal.
export function ReasonLine({ task, goals, onLink }) {
  const q = task.important === undefined ? undefined : (task.important ? 0 : 2) + (task.urgent ? 0 : 1)
  const g = goals.find((x) => x.id === task.goalId)
  const box = task.fun ? 'For fun' : Q[q]?.name
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-slate-700">
      {box && <span className="flex items-center gap-1.5 font-medium"><span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${q === undefined ? 'bg-leaf' : Q[q].dot}`} />{box}</span>}
      {box && <span aria-hidden="true">·</span>}
      {g ? <span><span className="font-medium" style={{ color: LEVELS[g.level].color }}>{LEVELS[g.level].name}</span>: {g.title}</span>
        : task.fun ? <span>Time for you</span>
        : <span>No goal yet · <button type="button" className="text-accent underline" onClick={onLink}>Link one</button></span>}
    </p>
  )
}

// Warning for anything that is a key to the workspace. Words + icon, not colour alone.
export const PrivateWarning = ({ children }) => (
  <p className="mt-2 flex gap-2 rounded-xl bg-danger-tint p-3 text-sm text-ink"><span aria-hidden="true">⚠</span><span><b className="font-medium">Keep it private.</b> {children}</span></p>
)
