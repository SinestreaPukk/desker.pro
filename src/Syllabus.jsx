import { useState } from 'react'
import { post } from './api.js'
import { btn, input, BLUE, ghost } from './ui.js'
import { encodeFile } from './files.js'
import { addTasks } from './tasks.js'
import { validItems, spreadBlocks } from './syllabus.js'

// Pasted outline or PDF/photo -> review list -> deadlines plus study blocks spread backwards from each due date.
export default function Syllabus({ deadlines, setDeadlines, tasks, setTasks, ratio }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState(null) // review list: [{ ...item, on, id }]
  const [made, setMade] = useState('')

  const find = async (body) => {
    setBusy(true); setError(''); setMade('')
    try {
      const out = await post('/api/syllabus', { ...body, ratio })
      const list = validItems(out.items)
      if (!list.length) throw new Error('No dated exams or assignments found. Check that the outline includes dates.')
      setItems(list.map((i, k) => ({ ...i, id: k, on: !i.past })))
    } catch (err) { setError(err.message) }
    setBusy(false)
  }
  const upload = async (file) => {
    try { await find(await encodeFile(file)) } catch (err) { setError(err.message) }
  }
  const patch = (id, p) => setItems(items.map((i) => (i.id === id ? { ...i, ...p } : i)))
  const create = () => {
    const chosen = items.filter((i) => i.on && i.title.trim() && i.date)
    const base = Math.max(Date.now(), ...deadlines.map((d) => d.id + 1))
    const dls = chosen.map((i, k) => ({ id: base + k, title: i.title.trim(), date: i.date, hours: i.hours, context: `From syllabus (${i.type || 'item'}).` }))
    const blocks = chosen.flatMap((i, k) => spreadBlocks({ title: i.title.trim(), date: i.date, hours: i.hours }).map((b) => ({ ...b, deadlineId: base + k })))
    setDeadlines([...deadlines, ...dls])
    setTasks(addTasks(tasks, blocks))
    setMade(`Added ${dls.length} deadline${dls.length === 1 ? '' : 's'} and ${blocks.length} study blocks. Rank them in Tasks.`)
    setItems(null); setText('')
  }
  return (
    <details className="mb-4 bg-panel p-4">
      <summary className="cursor-pointer font-semibold">Import a syllabus or course outline</summary>
      {!items && (
        <div className="mt-3 space-y-2">
          <p className="text-base text-slate-600">Paste the outline or upload a PDF or photo. The AI finds every exam and assignment with its date, you check the list, and Desker adds the deadlines with study blocks leading up to each one.</p>
          <textarea className={`${input} w-full`} rows={4} aria-label="Course outline" placeholder="Paste the course outline here" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <button className={`${btn} ${BLUE}`} disabled={busy || !text.trim()} onClick={() => find({ text })}>{busy ? 'Reading…' : 'Find deadlines'}</button>
            <label className={`${btn} inline-flex cursor-pointer items-center ${ghost} ${busy ? 'pointer-events-none opacity-50' : ''}`}>Upload PDF or photo
              <input type="file" className="sr-only" accept="application/pdf,image/*,.txt,.md" disabled={busy} onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) upload(f) }} />
            </label>
          </div>
        </div>
      )}
      {items && (
        <div className="mt-3">
          <p className="mb-2 text-base text-slate-600">Found {items.length} item{items.length === 1 ? '' : 's'}. Untick what you do not want and fix anything wrong. Dates in the past are unticked.</p>
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 bg-slate-50 p-2">
                <input type="checkbox" aria-label={`Include ${i.title}`} checked={i.on} onChange={(e) => patch(i.id, { on: e.target.checked })} />
                <input className={`${input} min-w-40 flex-1`} aria-label="Title" value={i.title} onChange={(e) => patch(i.id, { title: e.target.value })} />
                <input type="date" className={input} aria-label="Due date" value={i.date} onChange={(e) => patch(i.id, { date: e.target.value, past: false })} />
                <label className="flex items-center gap-1 text-base">Hours
                  <input type="number" min="0.5" step="0.5" className={`${input} w-20`} value={i.hours} onChange={(e) => patch(i.id, { hours: +e.target.value || 1 })} />
                </label>
                {i.type && <span className="text-xs text-slate-600">{i.type}</span>}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={`${btn} ${BLUE}`} disabled={!items.some((i) => i.on)} onClick={create}>Add {items.filter((i) => i.on).length} deadline{items.filter((i) => i.on).length === 1 ? '' : 's'} with study blocks</button>
            <button className={`${btn} ${ghost}`} onClick={() => setItems(null)}>Start over</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-base text-danger">{error}</p>}
      {made && <p role="status" className="mt-2 text-base">{made}</p>}
    </details>
  )
}
