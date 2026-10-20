import { useState, useEffect } from 'react'

const Q = [
  { name: 'Do First', hint: 'Urgent + Important', cls: 'bg-red-100' },
  { name: 'Schedule', hint: 'Not Urgent + Important', cls: 'bg-sky-100' },
  { name: 'Delegate', hint: 'Urgent + Not Important', cls: 'bg-amber-100' },
  { name: 'Eliminate', hint: 'Not Urgent + Not Important', cls: 'bg-slate-100' },
]
// Goals pyramid, narrowest (top) to widest (base)
const LEVELS = [
  { name: 'Vision', hint: 'Life purpose / who you want to be', w: 'w-1/3', cls: 'bg-violet-200' },
  { name: 'Long-term', hint: '5+ years', w: 'w-1/2', cls: 'bg-indigo-200' },
  { name: 'Mid-term', hint: '1-3 years', w: 'w-3/4', cls: 'bg-blue-200' },
  { name: 'Short-term', hint: 'This quarter', w: 'w-full', cls: 'bg-cyan-200' },
]
// undefined until the AI has ranked the task
const quadrant = (t) => t.important === undefined ? undefined : (t.important ? 0 : 2) + (t.urgent ? 0 : 1)

function useLocal(key, init) {
  const [v, setV] = useState(() => JSON.parse(localStorage.getItem(key) ?? JSON.stringify(init)))
  useEffect(() => localStorage.setItem(key, JSON.stringify(v)), [key, v])
  return [v, setV]
}

// ponytail: calls Anthropic straight from the browser with the user's own key (no backend); proxy it before sharing the app.
async function prioritise(apiKey, goals, tasks) {
  const prompt = `You prioritise tasks using a goals pyramid plus the Eisenhower matrix.
The user's goals pyramid (Vision at the top supports Long-term, then Mid-term, then Short-term):
${JSON.stringify(goals.map(({ id, title, level }) => ({ id, level: LEVELS[level].name, title })))}

Today is ${new Date().toISOString().slice(0, 10)}.
Tasks (JSON): ${JSON.stringify(tasks.map(({ id, title, due }) => ({ id, title, due })))}

For each task decide:
- goalId: the id of the single goal it best serves, or null if it serves none. Prefer the most specific (lowest) level that fits.
- important: true only if it meaningfully advances a goal (higher pyramid levels weigh more); tasks serving no goal are not important.
- urgent: does it need doing soon (due date close/overdue, or time-sensitive)? Anything due within 3 days (or overdue) is urgent regardless of importance.
Reply with ONLY a JSON array: [{"id": <id>, "goalId": <goal id or null>, "important": true|false, "urgent": true|false, "reason": "<1-2 short sentences: which goal it serves and why that makes it important or not, and why it is or is not urgent>"}]`
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || res.statusText)
  const text = data.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error(`No answer from model (${data.stop_reason})`)
  return JSON.parse(text.match(/\[[\s\S]*\]/)[0])
}

function Happy({ value = 50, onChange }) {
  return (
    <label className="flex items-center gap-1 text-xs" title={`Happiness: ${value}`}>
      <span>😞</span>
      <input type="range" min="0" max="100" className="w-24" value={value} onChange={(e) => onChange(+e.target.value)} />
      <span>😊</span>
    </label>
  )
}

const btn = 'rounded px-2 py-1 text-sm'
const input = 'rounded border border-slate-300 px-2 py-1 bg-white'

function Row({ t, onToggle, onHappy, onEdit, onDelete }) {
  return (
    <li className="rounded bg-white/70 px-2 py-1">
      <div className="flex items-center justify-between gap-2">
        <label className="flex min-w-0 items-center gap-2">
          <input type="checkbox" checked={t.done} onChange={onToggle} />
          <span className={`break-words ${t.done ? 'text-slate-400 line-through' : ''}`}>
            {t.title}
            {t.due && <span className="ml-2 text-xs text-slate-500">{t.due}</span>}
          </span>
        </label>
        <span className="flex shrink-0 gap-1">
          <button className={`${btn} hover:bg-white`} onClick={onEdit}>Edit</button>
          <button className={`${btn} text-red-700 hover:bg-white`} onClick={onDelete}>Delete</button>
        </span>
      </div>
      <div className="pl-6"><Happy value={t.happy} onChange={onHappy} /></div>
    </li>
  )
}

function Goals({ goals, setGoals }) {
  const blank = { title: '', level: 3 }
  const [d, setD] = useState(blank)
  const submit = (e) => {
    e.preventDefault()
    if (!d.title.trim()) return
    setGoals(d.id ? goals.map((g) => (g.id === d.id ? d : g)) : [...goals, { ...d, id: Date.now() }])
    setD(blank)
  }
  return (
    <>
      <p className="mb-2 text-sm text-slate-600">Build your goals pyramid. The AI links each task to a goal and uses its level to judge importance.</p>
      <form className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-white p-3 shadow-sm" onSubmit={submit}>
        <input className={`${input} min-w-48 flex-1`} placeholder="Goal" value={d.title}
          onChange={(e) => setD({ ...d, title: e.target.value })} />
        <select className={input} value={d.level} onChange={(e) => setD({ ...d, level: +e.target.value })}>
          {LEVELS.map((l, i) => <option key={l.name} value={i}>{l.name} ({l.hint})</option>)}
        </select>
        <button className={`${btn} bg-slate-800 text-white`}>{d.id ? 'Save' : 'Add'}</button>
        {d.id && <button type="button" className={`${btn} border`} onClick={() => setD(blank)}>Cancel</button>}
      </form>
      <div className="flex flex-col items-center gap-1">
        {LEVELS.map((l, i) => (
          <section key={l.name} className={`${l.w} ${l.cls} rounded-lg p-3`}>
            <h2 className="text-center font-semibold">{l.name} <span className="text-xs font-normal text-slate-600">{l.hint}</span></h2>
            <ul className="mt-2 space-y-1">
              {goals.filter((g) => g.level === i).map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 rounded bg-white/70 px-2 py-1">
                  <span className="min-w-0 break-words">{g.title}</span>
                  <span className="flex shrink-0 gap-1">
                    <button className={`${btn} hover:bg-white`} onClick={() => setD(g)}>Edit</button>
                    <button className={`${btn} text-red-700 hover:bg-white`} onClick={() => setGoals(goals.filter((x) => x.id !== g.id))}>Delete</button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}

function Tasks({ goals, tasks, setTasks }) {
  const [apiKey, setApiKey] = useLocal('apiKey', import.meta.env.VITE_ANTHROPIC_API_KEY || '')
  const blank = { title: '', due: '', happy: 50 }
  const [d, setD] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!d.title.trim()) return
    // editing drops the old ranking so the task gets re-prioritised
    setTasks(d.id
      ? tasks.map((t) => (t.id === d.id ? { id: d.id, done: t.done, title: d.title, due: d.due, happy: d.happy ?? 50 } : t))
      : [...tasks, { ...d, id: Date.now(), done: false }])
    setD(blank)
  }
  const update = (id, patch) => setTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)))

  const run = async () => {
    setBusy(true); setError('')
    try {
      const open = tasks.filter((t) => !t.done)
      const ranks = await prioritise(apiKey, goals, open)
      setTasks(tasks.map((t) => {
        const r = ranks.find((r) => r.id === t.id)
        return r ? { ...t, goalId: r.goalId, important: !!r.important, urgent: !!r.urgent, reason: r.reason } : t
      }))
    } catch (err) { setError(err.message) }
    setBusy(false)
  }

  const all = tasks.map((t) => ({ ...t, q: quadrant(t) }))
  const sorted = [...all].sort(
    (a, b) => a.done - b.done || (a.q ?? 9) - (b.q ?? 9) || (a.due || '9').localeCompare(b.due || '9')
  )
  const row = (t) => (
    <Row key={t.id} t={t} onToggle={() => update(t.id, { done: !t.done })} onHappy={(happy) => update(t.id, { happy })} onEdit={() => setD(t)}
      onDelete={() => setTasks(tasks.filter((x) => x.id !== t.id))} />
  )
  const unranked = all.filter((t) => t.q === undefined)

  return (
    <>
      <form className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-white p-3 shadow-sm" onSubmit={submit}>
        <input className={`${input} min-w-48 flex-1`} placeholder="Task" value={d.title}
          onChange={(e) => setD({ ...d, title: e.target.value })} />
        <input type="date" className={input} value={d.due} onChange={(e) => setD({ ...d, due: e.target.value })} />
        <Happy value={d.happy} onChange={(happy) => setD({ ...d, happy })} />
        <button className={`${btn} bg-slate-800 text-white`}>{d.id ? 'Save' : 'Add'}</button>
        {d.id && <button type="button" className={`${btn} border`} onClick={() => setD(blank)}>Cancel</button>}
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input type="password" className={`${input} min-w-48 flex-1`} placeholder="Anthropic API key (stored in this browser only)"
          value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        <button className={`${btn} bg-indigo-600 text-white disabled:opacity-50`}
          disabled={busy || !apiKey || !goals.length || !tasks.some((t) => !t.done)} onClick={run}>
          {busy ? 'Prioritising…' : 'Prioritise with AI'}
        </button>
        {!goals.length && <span className="text-sm text-slate-600">Add a goal first.</span>}
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>

      <h2 className="mb-2 font-semibold">Priority List</h2>
      <ol className="mb-6 space-y-1">
        {sorted.map((t) => (
          <li key={t.id} className={`${t.q === undefined ? 'bg-white' : Q[t.q].cls} rounded p-1`}>
            <ul>{row(t)}</ul>
            <span className="px-2 text-xs text-slate-600">{t.q === undefined ? 'Not prioritised yet' : Q[t.q].name}</span>
          </li>
        ))}
      </ol>

      <div className="grid gap-3 sm:grid-cols-2">
        {Q.map((q, i) => (
          <section key={q.name} className={`${q.cls} rounded-lg p-3`}>
            <h2 className="font-semibold">{q.name} <span className="text-xs font-normal text-slate-600">{q.hint}</span></h2>
            <ul className="mt-2 space-y-1">{all.filter((t) => t.q === i).map(row)}</ul>
          </section>
        ))}
      </div>
      {sorted.some((t) => t.reason) && (
        <section className="mt-6">
          <h2 className="mb-2 font-semibold">Why this placement?</h2>
          <ul className="space-y-2 text-sm">
            {sorted.filter((t) => t.reason).map((t) => {
              const goal = goals.find((g) => g.id === t.goalId)
              return (
                <li key={t.id} className={`${Q[t.q].cls} rounded p-2`}>
                  <b>{t.title}</b> → {Q[t.q].name}
                  <span className="text-slate-600"> · {goal ? `${LEVELS[goal.level].name} goal: ${goal.title}` : 'No matching goal'}</span>
                  <p>{t.reason}</p>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {unranked.length > 0 && <p className="mt-3 text-sm text-slate-600">{unranked.length} task(s) waiting for AI prioritisation.</p>}
    </>
  )
}

export default function App() {
  const [tab, setTab] = useState('Goals')
  const [goals, setGoals] = useLocal('goalList', [])
  const [tasks, setTasks] = useLocal('tasks', [])
  return (
    <main className="mx-auto max-w-4xl p-4">
      <h1 className="mb-3 text-2xl font-bold">Eisenhower Matrix</h1>
      <nav className="mb-4 flex gap-2">
        {['Goals', 'Tasks'].map((t) => (
          <button key={t} className={`${btn} border ${tab === t ? 'bg-slate-800 text-white' : 'bg-white'}`}
            onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      {tab === 'Goals'
        ? <Goals goals={goals} setGoals={setGoals} />
        : <Tasks goals={goals} tasks={tasks} setTasks={setTasks} />}
    </main>
  )
}
