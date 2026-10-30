import { SLICES, SLICE_COLOR, weekReview } from './review.js'

const h = (n) => `${Math.round(n * 10) / 10}h`
function Bar({ label, values }) {
  const total = SLICES.reduce((a, s) => a + values[s], 0)
  return (
    <div className="mb-2">
      <p className="mb-1 text-xs text-slate-700">{label}: {h(total)}</p>
      <div className="flex h-4 border border-line bg-yuki-1" role="img"
        aria-label={`${label}: ${SLICES.filter((s) => values[s]).map((s) => `${s} ${h(values[s])}`).join(', ') || 'nothing'}`}>
        {SLICES.filter((s) => values[s] > 0).map((s) => <span key={s} style={{ width: `${(values[s] / total) * 100}%`, background: SLICE_COLOR[s] }} title={`${s}: ${h(values[s])}`} />)}
      </div>
    </div>
  )
}

// Weekly goal-alignment card for the Goals tab.
export default function Review({ tasks, goals, onAgent }) {
  const r = weekReview(tasks, goals)
  return (
    <section className="px-panel p-4" aria-label="This week">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">This week {r.alignment !== null && <span className="text-xs text-slate-700">, {r.alignment}% of planned work links to a goal</span>}</h2>
        <button className="min-h-11 underline" onClick={onAgent}>Discuss with the AI agent</button>
      </div>
      {r.empty ? <p className="text-slate-700">Plan a few tasks for this week (give them a planned day) and you will see how your time splits across your goals.</p> : (
        <>
          <Bar label="Planned" values={r.planned} />
          <Bar label="Done" values={r.done} />
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-700">
            {SLICES.map((s) => <li key={s} className="flex items-center gap-1"><span className="h-2 w-2" style={{ background: SLICE_COLOR[s] }} />{s}</li>)}
          </ul>
        </>
      )}
    </section>
  )
}
