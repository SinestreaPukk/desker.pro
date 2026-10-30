import { useState } from 'react'
import { post } from '../api.js'
import { addTasks } from '../tasks.js'
import { BLUE, btn, ghost, input, panel, LEVELS } from '../ui.js'
import { REPEATS, todayStr, fmtDate } from '../shared.jsx'
import { parseQuick, inList } from '../lists.js'

const plus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv') }
const label = 'flex flex-col gap-1 text-xs text-slate-600'

// The one box that adds everything. Type what needs doing, set when / repeat / hours right here, or let the AI estimate the hours
// (it may ask a question or two, and can offer to split a big job into steps). No date means no deadline; Repeat covers ongoing work.
export default function AddBox({ inputRef, tasks, setTasks, deadlines, setDeadlines, projects, goals, ratio, list, setList, children }) {
  const [text, setText] = useState('')
  const [f, setF] = useState({ date: '', time: '', repeat: '', hours: '', belongs: '' })
  const [est, setEst] = useState(null) // { busy } | { question, context, asked } | { out, context } | { error }
  const [answer, setAnswer] = useState('')
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const parsed = text.trim() ? parseQuick(text, projects) : null
  const due = f.date || parsed?.due
  const start = f.time || parsed?.start
  const hours = f.hours !== '' ? +f.hours : parsed?.hours
  const [kind, id] = f.belongs.split(':')
  const dl = kind === 'd' ? deadlines.find((d) => d.id === +id) : null
  const projectId = kind === 'p' ? +id : dl?.projectId ?? parsed?.projectId
  const reset = () => { setText(''); setF({ date: '', time: '', repeat: '', hours: '', belongs: '' }); setEst(null); setAnswer('') }

  const add = (e) => {
    e.preventDefault()
    if (!parsed) return
    const date = start && !due ? todayStr() : due || dl?.date
    const item = { title: parsed.title, ...(date && { due: date }), ...(start && { when: date, start }), ...(hours && { hours }), ...(f.repeat && { repeat: f.repeat }),
      ...(projectId && { projectId }), ...(dl && { deadlineId: dl.id }) }
    setTasks(addTasks(tasks, [item]))
    if (!inList(item, list, todayStr())) setList('all') // never let a new task vanish from view
    reset()
  }

  const ask = async (context = '', asked = 0) => {
    setEst({ busy: true })
    try {
      const out = await post('/api/deadline', {
        goals: goals.map(({ id, title, level, happiness }) => ({ id, level: LEVELS[level].name, kind: happiness ? 'happiness' : 'work', title })),
        deadline: { title: parsed.title, date: due || null, hours: hours ?? null, context }, asked, ratio,
      })
      if (out.question) setEst({ question: out.question, context, asked: asked + 1 })
      else if (Array.isArray(out.options) && out.options.length) setEst({ out, context })
      else throw new Error('Unexpected answer from AI')
    } catch (err) { setEst({ error: err.message }) }
  }
  const reply = (e) => {
    e.preventDefault()
    if (!answer.trim()) return
    const context = `${est.context}\nQ: ${est.question}\nA: ${answer.trim()}`.trim()
    setAnswer(''); ask(context, est.asked)
  }
  const steps = () => {
    const { out, context } = est, ok = (d) => /^\d{4}-\d\d-\d\d$/.test(d) && (!due || d <= due), gid = Date.now()
    if (due) setDeadlines([...deadlines, { id: gid, title: parsed.title, date: due, time: f.time || undefined, hours: Number.isFinite(out.hours) ? out.hours : undefined, context, projectId }])
    setTasks(addTasks(tasks, out.options.map((o) => ({ title: o.title, ...(ok(o.due) ? { due: o.due } : due ? { due } : {}), hours: Number(o.hours) || undefined, ...(due && { deadlineId: gid }), ...(projectId && { projectId }) }))))
    setList('all'); reset()
  }

  return (
    <form className={`${panel} mb-4`} onSubmit={add}>
      <div className="flex gap-2">
        <input ref={inputRef} className={`${input} min-w-0 flex-1`} placeholder='What needs doing? e.g. "Statics quiz Monday 3pm"' aria-label="What needs doing" value={text} onChange={(e) => { setText(e.target.value); setEst(null) }} />
        <button className={`${btn} ${BLUE}`} disabled={!parsed}>Add</button>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className={label}>When
          <div className="flex items-center gap-1">
            <input type="date" className={input} aria-label="Date" value={f.date || parsed?.due || ''} onChange={(e) => set({ date: e.target.value })} />
            <input type="time" className={input} aria-label="Time" value={f.time || parsed?.start || ''} onChange={(e) => set({ time: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-1" role="group" aria-label="Quick dates">
          {[['Today', 0], ['Tomorrow', 1]].map(([n, d]) => <button key={n} type="button" className={`${btn} ${ghost} chip`} onClick={() => set({ date: plus(d) })}>{n}</button>)}
          {(f.date || f.time) && <button type="button" className={`${btn} chip hover:bg-white`} onClick={() => set({ date: '', time: '' })}>No date</button>}
        </div>
        <label className={label}>Repeat
          <select className={input} value={f.repeat} onChange={(e) => set({ repeat: e.target.value })}>{REPEATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
        <div className={label}>Hours I need
          <div className="flex gap-1">
            <input type="number" min="0" step="0.5" className={`${input} w-24`} aria-label="Hours I need" placeholder={parsed?.hours ? String(parsed.hours) : 'Not sure'} value={f.hours} onChange={(e) => set({ hours: e.target.value })} />
            <button type="button" className={`${btn} ${ghost}`} disabled={!parsed || est?.busy} onClick={() => ask()}>{est?.busy ? 'Thinking…' : '✨ Estimate'}</button>
          </div>
        </div>
        {(deadlines.length > 0 || projects.length > 0) && (
          <label className={label}>Belongs to
            <select className={input} value={f.belongs} onChange={(e) => set({ belongs: e.target.value })}>
              <option value="">Nothing</option>
              {deadlines.some((d) => !d.done) && <optgroup label="Deadlines">{deadlines.filter((d) => !d.done).map((d) => <option key={d.id} value={`d:${d.id}`}>{d.title} · {fmtDate(d.date)}</option>)}</optgroup>}
              {projects.length > 0 && <optgroup label="Projects">{projects.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.title}</option>)}</optgroup>}
            </select>
          </label>
        )}
      </div>
      {parsed && (due || start || hours) && <p className="mt-2 text-sm text-slate-600" aria-live="polite">{[due && fmtDate(due), start, hours && `${hours}h`, f.repeat && REPEATS.find(([v]) => v === f.repeat)[1].toLowerCase()].filter(Boolean).join(' · ')}</p>}
      {est && !est.busy && (
        <div className="mt-3 rounded-xl bg-pale p-3 text-sm" role="status">
          {est.error && <p className="text-danger">{est.error}</p>}
          {est.question && (
            <div>
              <p className="mb-2 font-medium">{est.question}</p>
              <div className="flex gap-2">
                <input className={`${input} min-w-0 flex-1`} aria-label="Your answer" autoFocus value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && reply(e)} />
                <button type="button" className={`${btn} ${BLUE}`} onClick={reply}>Answer</button>
                <button type="button" className={`${btn} hover:bg-white`} onClick={() => ask(`${est.context}\nQ: ${est.question}\nA: not sure, make your best guess`, 2)}>Not sure</button>
              </div>
            </div>
          )}
          {est.out && (
            <div>
              <p>{est.out.summary}</p>
              {est.out.options.length > 1 && <ul className="mt-2 space-y-1">{est.out.options.map((o, i) => <li key={i} className="rounded-lg bg-white px-3 py-1.5"><b className="font-medium">{o.title}</b> <span className="text-slate-600">{o.hours}h{o.due ? ` · by ${fmtDate(o.due)}` : ''}</span></li>)}</ul>}
              <div className="mt-2 flex flex-wrap gap-2">
                {Number.isFinite(est.out.hours) && <button type="button" className={`${btn} ${BLUE}`} onClick={() => { set({ hours: String(est.out.hours) }); setEst(null) }}>Use {est.out.hours}h</button>}
                {est.out.options.length > 1 && <button type="button" className={`${btn} ${ghost}`} onClick={steps}>Add as {est.out.options.length} steps</button>}
                <button type="button" className={`${btn} hover:bg-white`} onClick={() => setEst(null)}>Dismiss</button>
              </div>
            </div>
          )}
        </div>
      )}
      {children}
    </form>
  )
}
