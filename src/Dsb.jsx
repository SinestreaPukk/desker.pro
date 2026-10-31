import { useEffect, useState } from 'react'
import { BLUE, btn, input, panel } from './ui.js'

const NAMES = { chat: 'AI agent chat', deadline: 'Split a task / deadline', project: 'Project breakdown', prioritise: 'Prioritise tasks', now: 'Right now pick', syllabus: 'Syllabus import', replan: 'Replan week', read: 'Read file, photo or link' }
const n = (v) => Math.round(v).toLocaleString()
const usd = (v) => `$${v < 1 ? v.toFixed(4) : v.toFixed(2)}`
const per = (v, d) => (d ? v / d : 0)

const Tile = ({ label, value, sub }) => (
  <div className={`${panel} !p-4`}>
    <p className="text-base text-slate-600">{label}</p>
    <p className="mt-1 text-2xl tabular-nums">{value}</p>
    {sub && <p className="mt-1 break-words text-base text-slate-600">{sub}</p>}
  </div>
)


// Beta health (Phase 8). Every block comes from its own query: if one fails (say the events table is not applied) only that tile says so.
const pc = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : 'no data yet')
const val = (q) => (q?.ok ? q.v : null)
const row = (q) => val(q)?.[0]
function Beta({ b, th, td }) {
  if (!b) return null
  const ret = row(b.ret), pa = row(b.perActive), du = row(b.durations), ri = row(b.rituals), rr = row(b.ritualRet), ev = row(b.events)
  const bad = Object.entries(b).filter(([, q]) => !q.ok).map(([k, q]) => `${k}: ${q.error}`)
  const acc = val(b.accuracy) || []
  const evNote = ev ? null : 'needs the events table (db/migrations/002_events.sql) and ANALYTICS=on'
  return (
    <>
      <h2 className="mb-2 font-semibold">Beta health: growth and retention</h2>
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Back the next day (D1)" value={ret ? pc(ret.b1, ret.e1) : 'n/a'} sub={ret && `${ret.b1} of ${ret.e1}`} />
        <Tile label="Back around day 7 (D7)" value={ret ? pc(ret.b7, ret.e7) : 'n/a'} sub={ret && `${ret.b7} of ${ret.e7}, opened on day 7 or 8`} />
        <Tile label="Back in week 4 (W4)" value={ret ? pc(ret.b28, ret.e28) : 'n/a'} sub={ret && `${ret.b28} of ${ret.e28}, opened on days 28 to 34`} />
        <Tile label="Weekly active users" value={n(val(b.wau)?.at(-1)?.n ?? 0)} sub="Opened Desker in the latest week" />
        <Tile label="Tasks done per active user" value={pa ? (pa.active7 ? (pa.done7 / pa.active7).toFixed(1) : 'n/a') : 'n/a'} sub={pa && `${pa.done7} done by ${pa.active7} people in 7 days`} />
      </div>
      <div className={`${panel} mb-8 overflow-x-auto !p-0`}>
        <table className="w-full min-w-[420px] text-base">
          <thead className="text-slate-600"><tr><th className={th}>Week starting</th><th className={th}>Sign-ups</th><th className={th}>Active people</th></tr></thead>
          <tbody>
            {[...new Set([...(val(b.signups) || []).map((x) => x.week), ...(val(b.wau) || []).map((x) => x.week)])].sort().map((w) => (
              <tr key={w} className="border-t border-line"><td className={td}>{w}</td><td className={td}>{val(b.signups)?.find((x) => x.week === w)?.n ?? 0}</td><td className={td}>{val(b.wau)?.find((x) => x.week === w)?.n ?? 0}</td></tr>
            ))}
            {!val(b.signups)?.length && !val(b.wau)?.length && <tr><td className={`${td} text-slate-600`} colSpan={3}>No data yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 font-semibold">Beta health: is the rhythm engine working?</h2>
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Finished tasks with a real duration" value={du ? pc(du.timed + du.chip, du.done) : 'n/a'} sub={du && `${du.timed} timed and ${du.chip} from the chips, of ${du.done} done`} />
        <Tile label="Energy check-ins per active user" value={pa && val(b.energy) ? (pa.active7 ? (row(b.energy).n / pa.active7).toFixed(1) : 'n/a') : 'n/a'} sub="Last 7 days" />
      </div>
      <div className={`${panel} mb-8 overflow-x-auto !p-0`}>
        <table className="w-full min-w-[520px] text-base">
          <thead className="text-slate-600"><tr><th className={th}>Weeks since sign-up</th><th className={th}>Finished tasks</th><th className={th}>Median error, own estimate</th><th className={th}>Median error, Desker's plan</th></tr></thead>
          <tbody>
            {acc.map((r) => (
              <tr key={r.week} className="border-t border-line"><td className={td}>{r.week === 12 ? '12+' : r.week}</td><td className={td}>{r.n}</td><td className={td}>{Math.round(r.est_err * 100)}%</td><td className={td}>{r.plan_err == null ? 'n/a' : `${Math.round(r.plan_err * 100)}%`}</td></tr>
            ))}
            {!acc.length && <tr><td className={`${td} text-slate-600`} colSpan={4}>No data yet. The plan error should fall below the estimate error as weeks go by; that is the proof the engine works.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 font-semibold">Beta health: the companion</h2>
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Wrap-ups per active day" value={ri ? pc(ri.wrapups, ri.active_days) : 'n/a'} sub={ri && `${ri.wrapups} wrap-ups over ${ri.active_days} active days, 28 days`} />
        <Tile label="Morning plans per active day" value={ri ? pc(ri.morning_done, ri.active_days) : 'n/a'} sub={ri && `${ri.morning_done} done, 28 days`} />
        <Tile label="Notifications opened" value={ev ? pc(ev.opened, ev.sent) : 'n/a'} sub={ev ? `${ev.opened} of ${ev.sent} sent, 28 days` : evNote} />
        <Tile label="Back in week 4: ritual users vs not" value={rr ? `${pc(rr.ritual_back, rr.ritual_n)} vs ${pc(rr.other_back, rr.other_n)}` : 'n/a'} sub={rr && `${rr.ritual_back}/${rr.ritual_n} with 3+ rituals in their first two weeks, ${rr.other_back}/${rr.other_n} without`} />
      </div>
      <p className="mb-8 text-base text-slate-600">Rates are per active day or per notification, not per person. Small numbers swing a lot in a 20 to 50 person beta; read them as direction, not proof.{bad.length ? ` Failed: ${bad.join('; ')}.` : ''}</p>
    </>
  )
}

// Owner dashboard at /dsb. The password is checked on the server; it is only kept for this tab.
export default function Dsb() {
  const [pw, setPw] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async (e, quiet) => {
    e?.preventDefault?.()
    setBusy(true); setError('')
    try {
      const r = await fetch('/api/dsb', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw }) })
      const out = await r.json().catch(() => ({}))
      if (!r.ok && quiet) return setBusy(false) // not the owner: show the password form
      if (!r.ok) throw new Error(r.status === 429 ? 'Too many tries. Wait an hour.' : out.error || 'Something went wrong')
      setData(out)
    } catch (err) { setError(err.message) }
    setBusy(false)
  }

  useEffect(() => { load(null, true) }, []) // the signed-in owner skips the password

  if (!data) return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="greeting text-4xl">Dashboard</h1>
      <form className="flex flex-col gap-3" onSubmit={load}>
        <input type="password" autoFocus className={input} aria-label="Password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className={`${btn} ${BLUE}`} disabled={busy || !pw}>{busy ? 'Checking…' : 'Open'}</button>
        {error && <p role="alert" className="text-base text-danger">{error}</p>}
      </form>
    </main>
  )

  const { counts: c, ai, kinds, daily, habit: h, active, funnel: f, beta } = data
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : 'n/a')
  const tokens = ai.input + ai.output
  const max = Math.max(1, ...daily.map((d) => d.tokens))
  const th = 'px-3 py-2 text-left font-medium'
  const td = 'px-3 py-2 tabular-nums'
  return (
    <main className="mx-auto max-w-[1100px] p-4 pb-16 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="greeting text-4xl">Dashboard</h1>
        <button className={`${btn} border border-control bg-white`} onClick={load} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh'}</button>
      </div>

      <Beta b={beta} th={th} td={td} />

      <h2 className="mb-2 font-semibold">Habit</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Back the next day" value={pct(h.back1, h.eligible1)} sub={`${h.back1} of ${h.eligible1} accounts signed up at least a day ago`} />
        <Tile label="Back a week later" value={pct(h.back7, h.eligible7)} sub={`${h.back7} of ${h.eligible7} accounts signed up at least a week ago`} />
        <Tile label="Finished the goals guide" value={pct(h.guide_done, c.users)} sub={`${h.guide_done} of ${c.users} accounts, ${h.guide_started} started it`} />
      </div>

      <h2 className="mb-2 font-semibold">Where new people get to</h2>
      <div className={`${panel} mb-8`}>
        <ul className="space-y-1 text-base">
          {[['Signed up', f.signed], ['Added a task', f.added], ['Finished a task', f.finished], ['Finished 3 tasks', f.finished3], ['Finished the goals guide', f.guide]].map(([label, v]) => (
            <li key={label} className="flex items-center gap-3">
              <span className="w-52 shrink-0 text-slate-600">{label}</span>
              <span className="h-4 bg-primary" style={{ width: `${f.signed ? Math.max(2, (v / f.signed) * 45) : 2}%` }} aria-hidden="true" />
              <span className="tabular-nums">{v} ({pct(v, f.signed)})</span>
            </li>
          ))}
        </ul>
      </div>

      <h2 className="mb-2 font-semibold">People who opened Desker, last 14 days</h2>
      <div className={`${panel} mb-8`}>
        {active.length ? (
          <ul className="space-y-1 text-base">
            {active.map((d) => (
              <li key={d.day} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-slate-600">{d.day}</span>
                <span className="h-4 bg-primary" style={{ width: `${Math.max(2, (d.users / Math.max(...active.map((x) => x.users))) * 55)}%` }} aria-hidden="true" />
                <span className="tabular-nums">{d.users}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-base text-slate-600">Nothing yet. Opens are counted from when tracking was deployed.</p>}
      </div>

      <h2 className="mb-2 font-semibold">People and content</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Users" value={n(c.users)} sub={`${c.verified} verified, ${c.with_data} with data, ${c.active7} active in 7 days`} />
        <Tile label="Tasks" value={n(c.tasks)} sub={`${n(c.doneTasks)} done`} />
        <Tile label="Projects" value={n(c.projects)} />
        <Tile label="Deadlines" value={n(c.deadlines)} />
        <Tile label="Goals" value={n(c.goals)} />
        <Tile label="Hobbies" value={n(c.hobbies)} />
      </div>

      <h2 className="mb-2 font-semibold">AI usage so far</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Tokens used" value={n(tokens)} sub={`${n(ai.input)} in, ${n(ai.output)} out`} />
        <Tile label="Estimated cost" value={usd(ai.cost)} sub="At list price, no discounts" />
        <Tile label="AI calls" value={n(ai.calls)} sub={`${n(per(tokens, ai.calls))} tokens per call, ${usd(per(ai.cost, ai.calls))} per call`} />
        <Tile label="Users of AI" value={n(ai.users)} sub={`${usd(per(ai.cost, ai.users))} per user`} />
      </div>

      <h2 className="mb-2 font-semibold">All AI usage divided by</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['task', c.tasks], ['project', c.projects], ['deadline', c.deadlines], ['active user', c.with_data]].map(([name, d]) => (
          <Tile key={name} label={`Per ${name}`} value={`${n(per(tokens, d))} tokens`} sub={`${usd(per(ai.cost, d))} estimated`} />
        ))}
      </div>

      <h2 className="mb-2 font-semibold">By feature</h2>
      <div className={`${panel} mb-8 overflow-x-auto !p-0`}>
        <table className="w-full min-w-[640px] text-base">
          <thead className="text-slate-600"><tr><th className={th}>Feature</th><th className={th}>Calls</th><th className={th}>Avg in</th><th className={th}>Avg out</th><th className={th}>Avg tokens</th><th className={th}>Avg cost</th><th className={th}>Total tokens</th><th className={th}>Total cost</th></tr></thead>
          <tbody>
            {kinds.map((k) => (
              <tr key={k.kind} className="border-t border-line">
                <td className={`${td} font-medium`}>{NAMES[k.kind] || k.kind}</td>
                <td className={td}>{n(k.calls)}</td>
                <td className={td}>{n(per(k.input, k.calls))}</td>
                <td className={td}>{n(per(k.output, k.calls))}</td>
                <td className={td}>{n(per(k.input + k.output, k.calls))}</td>
                <td className={td}>{usd(per(k.cost, k.calls))}</td>
                <td className={td}>{n(k.input + k.output)}</td>
                <td className={td}>{usd(k.cost)}</td>
              </tr>
            ))}
            {!kinds.length && <tr><td className={`${td} text-slate-600`} colSpan={8}>No AI calls recorded yet. Usage is counted from when tracking was deployed.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 font-semibold">Last 14 days</h2>
      <div className={panel}>
        {daily.length ? (
          <ul className="space-y-1 text-base">
            {daily.map((d) => (
              <li key={d.day} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-slate-600">{d.day}</span>
                <span className="h-4 bg-primary" style={{ width: `${Math.max(2, (d.tokens / max) * 55)}%` }} aria-hidden="true" />
                <span className="tabular-nums">{n(d.tokens)} tokens, {d.calls} calls, {usd(d.cost)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-base text-slate-600">Nothing yet.</p>}
      </div>
    </main>
  )
}
