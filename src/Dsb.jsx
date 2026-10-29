import { useState } from 'react'
import { BLUE, btn, input, panel } from './ui.js'

const NAMES = { chat: 'AI agent chat', deadline: 'Split a task / deadline', project: 'Project breakdown', prioritise: 'Prioritise tasks', now: 'Right now pick', syllabus: 'Syllabus import', replan: 'Replan week', read: 'Read file, photo or link' }
const n = (v) => Math.round(v).toLocaleString()
const usd = (v) => `$${v < 1 ? v.toFixed(4) : v.toFixed(2)}`
const per = (v, d) => (d ? v / d : 0)

const Tile = ({ label, value, sub }) => (
  <div className={`${panel} !p-4`}>
    <p className="text-sm text-slate-600">{label}</p>
    <p className="mt-1 text-3xl tabular-nums">{value}</p>
    {sub && <p className="mt-1 text-sm text-slate-600">{sub}</p>}
  </div>
)

// Owner dashboard at /dsb. The password is checked on the server; it is only kept for this tab.
export default function Dsb() {
  const [pw, setPw] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const r = await fetch('/api/dsb', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw }) })
      const out = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(r.status === 429 ? 'Too many tries. Wait an hour.' : out.error || 'Something went wrong')
      setData(out)
    } catch (err) { setError(err.message) }
    setBusy(false)
  }

  if (!data) return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="greeting text-4xl">Dashboard</h1>
      <form className="flex flex-col gap-3" onSubmit={load}>
        <input type="password" autoFocus className={input} aria-label="Password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className={`${btn} ${BLUE}`} disabled={busy || !pw}>{busy ? 'Checking…' : 'Open'}</button>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </form>
    </main>
  )

  const { counts: c, ai, kinds, daily } = data
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

      <h2 className="mb-2 font-semibold">People and content</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Users" value={n(c.users)} sub={`${c.with_data} with data · ${c.active7} active in 7 days`} />
        <Tile label="Tasks" value={n(c.tasks)} sub={`${n(c.doneTasks)} done`} />
        <Tile label="Projects" value={n(c.projects)} />
        <Tile label="Deadlines" value={n(c.deadlines)} />
        <Tile label="Goals" value={n(c.goals)} />
        <Tile label="Hobbies" value={n(c.hobbies)} />
      </div>

      <h2 className="mb-2 font-semibold">AI usage so far</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Tokens used" value={n(tokens)} sub={`${n(ai.input)} in · ${n(ai.output)} out`} />
        <Tile label="Estimated cost" value={usd(ai.cost)} sub="At list price, no discounts" />
        <Tile label="AI calls" value={n(ai.calls)} sub={`${n(per(tokens, ai.calls))} tokens per call · ${usd(per(ai.cost, ai.calls))} per call`} />
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
        <table className="w-full min-w-[640px] text-sm">
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
          <ul className="space-y-1 text-sm">
            {daily.map((d) => (
              <li key={d.day} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-slate-600">{d.day}</span>
                <span className="h-4 rounded-full bg-primary" style={{ width: `${Math.max(2, (d.tokens / max) * 55)}%` }} aria-hidden="true" />
                <span className="tabular-nums">{n(d.tokens)} tokens · {d.calls} calls · {usd(d.cost)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-600">Nothing yet.</p>}
      </div>
    </main>
  )
}
