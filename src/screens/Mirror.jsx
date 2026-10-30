import { SLICES, SLICE_COLOR, weekReview, insight } from '../review.js'
import { fmtDuration } from '../format.js'
import { Button, Card, EmptyState } from '../components/ui.jsx'

// This week as a mirror: where did the time go, by goal level?
// Shows what was done; before anything is done it shows what is planned.
export default function Mirror({ tasks, goals, overdue, onReview, onReplan, onPlan }) {
  const r = weekReview(tasks, goals)
  const sum = (o) => SLICES.reduce((a, s) => a + o[s], 0)
  const done = sum(r.done) > 0
  const values = done ? r.done : r.planned
  const total = sum(values)
  const note = insight(values)
  const sunMon = [0, 1].includes(new Date().getDay()) // TODO(roadmap: Sunday weekly-review ritual): replace this day check with the scheduled ritual
  return (
    <Card title="This week">
      {r.empty ? (
        <EmptyState title="Nothing planned yet" action={onPlan && <Button variant="secondary" onClick={onPlan}>Help me plan my day</Button>}>
          Give a few tasks a planned day and you will see how your time splits across your goals.
        </EmptyState>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            {done ? 'Done' : 'Planned'}: <b className="font-medium text-ink">{fmtDuration(total)}</b>
            {done && <> · last week {r.lastDone > 0 ? fmtDuration(r.lastDone) : 'nothing logged'}</>}
          </p>
          <div className="mt-2 flex h-4 gap-0.5 overflow-hidden rounded-full bg-slate-100" role="img"
            aria-label={`${done ? 'Done' : 'Planned'} this week: ${SLICES.filter((s) => values[s] > 0).map((s) => `${s} ${fmtDuration(values[s])}`).join(', ')}`}>
            {SLICES.filter((s) => values[s] > 0).map((s) => <span key={s} style={{ width: `${(values[s] / total) * 100}%`, background: SLICE_COLOR[s] }} />)}
          </div>
          <ul className="mt-3 space-y-1.5">
            {SLICES.filter((s) => values[s] > 0).map((s) => (
              <li key={s} className="flex items-center gap-2 text-sm">
                <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm" style={{ background: SLICE_COLOR[s] }} />
                <span className="flex-1">{s}</span>
                <span className="tabular-nums text-slate-600">{fmtDuration(values[s])} · {Math.round((values[s] / total) * 100)}%</span>
              </li>
            ))}
          </ul>
          {note && <p className="mt-3 rounded-xl bg-white p-3 text-sm font-medium">{note}</p>}
        </>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant={sunMon ? 'primary' : 'secondary'} onClick={onReview}>Weekly review</Button>
        {overdue > 0 && <Button variant="secondary" onClick={onReplan}>Replan my week</Button>}
      </div>
    </Card>
  )
}
