import { useState } from 'react'
import { post } from '../api.js'
import { addTasks } from '../tasks.js'
import { BLUE, btn, ghost, input, panel, LEVELS } from '../ui.js'
import { REPEATS, todayStr, fmtDate } from '../shared.jsx'
import { fmtDuration } from '../format.js'
import { parseQuick, inList } from '../lists.js'

const plus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv') }
const label = 'flex flex-col gap-1 text-xs text-slate-600'
const ctl = `${input} h-10` // one height for every control in the row

// The one box that adds everything. Type what needs doing, set when / repeat / hours right here, or let the AI estimate the hours
// (it may ask a question or two, and can offer to split a big job into steps). No date means no deadline; Repeat covers ongoing work.
export default function AddBox({ inputRef, tasks, setTasks, deadlines, setDeadlines, projects, goals, ratio, list, setList, children }) {
  const [text, setText] = useState('')
  const [kind, setKind] = useState('Task') // Deadline needs a date and can be broken into tasks later
  const isDl = kind === 'Deadline'
  const [f, setF] = useState({ date: '', time: '', repeat: '', hours: '', belongs: '', until: '' })
  const [est, setEst] = useState(null) // { busy } | { question, context, asked } | { out, context } | { error }
  const [answer, setAnswer] = useState('')
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const parsed = text.trim() ? parseQuick(text, projects) : null
  const begin = f.date || parsed?.due
  const due = f.until && begin && f.until >= begin ? f.until : begin // with an end date the task spans begin -> until
  const start = f.time || parsed?.start
  const hours = f.hours !== '' ? +f.hours : parsed?.hours
  const [bk, id] = f.belongs.split(':')
  const dl = bk === 'd' ? deadlines.find((d) => d.id === +id) : null
  const projectId = bk === 'p' ? +id : dl?.projectId ?? parsed?.projectId
  const reset = () => { setText(''); setF({ date: '', time: '', repeat: '', hours: '', belongs: '', until: '' }); setEst(null); setAnswer('') }

  const add = (e) => {
    e.preventDefault()
    if (!parsed) return
    if (isDl) {
      if (!due) return
      setDeadlines([...deadlines, { id: Date.now(), title: parsed.title, date: due, ...(start && { time: start }), ...(hours && { hours }), ...(projectId && { projectId }) }])
      setList('plan'); return reset()
    }
    const date = start && !due ? todayStr() : due || dl?.date
    const item = { title: parsed.title, ...(date && { due: date }), ...(date && due !== begin && { from: begin }), ...(start && { when: date, start }), ...(hours && { hours }), ...(f.repeat && { repeat: f.repeat }),
      ...(projectId && { projectId }), ...(dl && { deadlineId: dl.id }) }
    setTasks(addTasks(tasks, [item]))
    if (!inList(item, list, todayStr())) setList(inList(item, 'plan', todayStr()) ? 'plan' : 'inbox') // never let a new task vanish from view
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
    if (due) setDeadlines([...deadlines, { id: gid, title: parsed.title, date: due, time: start || undefined, hours: Number.isFinite(out.hours) ? out.hours : undefined, context, projectId }])
    setTasks(addTasks(tasks, out.options.map((o) => ({ title: o.title, ...(ok(o.due) ? { due: o.due } : due ? { due } : {}), hours: Number(o.hours) || undefined, ...(due && { deadlineId: gid }), ...(projectId && { projectId }) }))))
    setList('plan'); reset()
  }

  return (
    <form className={`${panel} group mb-4`} onSubmit={add}>
      <div role="group" aria-label="Add a" className="mb-3 flex w-fit gap-1 rounded-full bg-white p-1">
        {['Deadline', 'Task'].map((m) => <button key={m} type="button" aria-pressed={kind === m} className={`${btn} !py-1 ${kind === m ? 'bg-primary font-medium text-ink' : 'text-slate-600'}`} onClick={() => setKind(m)}>{m}</button>)}
      </div>
      <div className="flex gap-2">
        <input ref={inputRef} className={`${input} min-w-0 flex-1`} placeholder={isDl ? 'Deadline, e.g. "Statics midterm Monday 3pm"' : 'What needs doing? e.g. "Call dentist tomorrow 3pm"'} aria-label="What needs doing" value={text} onChange={(e) => { setText(e.target.value); setEst(null) }} />
        <button className={`${btn} ${BLUE}`} disabled={!parsed || (isDl && !due)} title={isDl && !due ? 'Pick a date first' : undefined}>{isDl ? 'Add deadline' : 'Add'}</button>
      </div>
      <div className={`mt-3 flex-wrap items-end gap-3 ${parsed ? 'flex' : 'hidden group-focus-within:flex'}`}> {/* options appear once you start typing */}
        <div className={label}>When
          <div className="flex items-center gap-1">
            <input type="date" className={ctl} aria-label="Date" value={f.date || parsed?.due || ''} onChange={(e) => set({ date: e.target.value })} />
            <input type="time" className={ctl} aria-label="Time" value={f.time || parsed?.start || ''} onChange={(e) => set({ time: e.target.value })} />
          </div>
        </div>
        {!isDl && <label className={label}>Until (optional)
          <input type="date" className={ctl} min={begin || undefined} value={f.until} onChange={(e) => set({ until: e.target.value })} />
        </label>}
        <div className="flex gap-1" role="group" aria-label="Quick dates">
          {[['Today', 0], ['Tomorrow', 1]].map(([n, d]) => <button key={n} type="button" className={`${btn} ${ghost} chip h-10`} onClick={() => set({ date: plus(d) })}>{n}</button>)}
          {(f.date || f.time || f.until) && <button type="button" className={`${btn} chip h-10 hover:bg-white`} onClick={() => set({ date: '', time: '', until: '' })}>No date</button>}
        </div>
        {!isDl && <label className={label}>Repeat
          <select className={ctl} value={f.repeat} onChange={(e) => set({ repeat: e.target.value })}>{REPEATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>}
        <div className={label}>Hours I need
          <div className="flex gap-1">
            <input type="number" min="0" step="0.5" className={`${ctl} w-24`} aria-label="Hours I need" placeholder={parsed?.hours ? String(parsed.hours) : 'Not sure'} value={f.hours} onChange={(e) => set({ hours: e.target.value })} />
            <button type="button" className={`${btn} ${ghost} h-10`} disabled={!parsed || est?.busy} onClick={() => ask()}>{est?.busy ? 'Thinking…' : '✨ Estimate'}</button>
          </div>
        </div>
        {(isDl ? projects.length > 0 : deadlines.length > 0 || projects.length > 0) && (
          <label className={label}>Belongs to
            <select className={ctl} value={f.belongs} onChange={(e) => set({ belongs: e.target.value })}>
              <option value="">Nothing</option>
              {!isDl && deadlines.some((d) => !d.done) && <optgroup label="Deadlines">{deadlines.filter((d) => !d.done).map((d) => <option key={d.id} value={`d:${d.id}`}>{d.title} · {fmtDate(d.date)}</option>)}</optgroup>}
              {projects.length > 0 && <optgroup label="Projects">{projects.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.title}</option>)}</optgroup>}
            </select>
          </label>
        )}
      </div>
      {parsed && (due || start || hours) && <p className="mt-2 text-sm text-slate-600" aria-live="polite">{[begin && due !== begin ? `${fmtDate(begin)} → ${fmtDate(due)}` : due && fmtDate(due), start, hours && fmtDuration(+hours), f.repeat && REPEATS.find(([v]) => v === f.repeat)[1].toLowerCase()].filter(Boolean).join(' · ')}</p>}
      {isDl && parsed && !due && <p className="mt-2 text-sm text-slate-600">Pick a date (or type one, like "Monday") to add the deadline.</p>}
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
              {est.out.options.length > 1 && <ul className="mt-2 space-y-1">{est.out.options.map((o, i) => <li key={i} className="rounded-lg bg-white px-3 py-1.5"><b className="font-medium">{o.title}</b> <span className="text-slate-600">{fmtDuration(o.hours)}{o.due ? ` · by ${fmtDate(o.due)}` : ''}</span></li>)}</ul>}
              <div className="mt-2 flex flex-wrap gap-2">
                {Number.isFinite(est.out.hours) && <button type="button" className={`${btn} ${BLUE}`} onClick={() => { set({ hours: String(est.out.hours) }); setEst(null) }}>Use {fmtDuration(est.out.hours)}</button>}
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
