// The Board panel (SPEC §7, Phase 1 CP6): Due, Exams, Questions and News, with course filters. A side panel (4 columns), a bottom sheet with tabs on phones.
import { useState } from 'react'
import { OUTFIT_TINTS, can, courseOf, urgency, type Colour } from '@desker/shared'
import { addItem, announce, confirmItem, deleteItem, patchVillage, toPlanner, type Announcement, type BoardItem, type Info } from './api.ts'
import Questions from './Questions.tsx'

const hex = (c: string) => '#' + (OUTFIT_TINTS[c as Colour] ?? 0xf2f5fa).toString(16).padStart(6, '0')
const when = (ms: number, now: number) => {
  const d = ms - now, h = Math.round(d / 3_600_000)
  if (d < 0) return 'just passed'
  if (h < 1) return 'in under an hour'
  if (h < 24) return `in ${h} h`
  const days = Math.round(d / 86_400_000); return days === 1 ? 'tomorrow' : `in ${days} days`
}
const day = (ms: number) => new Date(ms).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })
type Tab = 'due' | 'exam' | 'q' | 'news'
const TABS: [Tab, string][] = [['due', 'Due'], ['exam', 'Exams'], ['q', 'Questions'], ['news', 'News']]
const WHY: Record<string, string> = { bad_course: 'Pick one of the village courses.', bad_date: 'Pick a date that has not passed.', bad_item: 'Add a title (2 letters or more).', forbidden: 'You cannot do that here.', slow_down: 'Slow down a little.' }
const why = (e: unknown) => WHY[(e as { code?: string })?.code ?? ''] ?? "That didn't work. Try again."

type Props = { items: BoardItem[] | null; news: Announcement[]; members: Info['members']; slug: string; me: string; role: string; courseTags: string[]; rev: number; openQ?: string | null; onChanged: () => void; onClose: () => void }

export default function Board({ items, news, members, slug, me, role, courseTags, rev, openQ, onChanged, onClose }: Props) {
  const now = Date.now(), by = new Map(members.map((m) => [m.userId, m]))
  const [tab, setTab] = useState<Tab>(openQ ? 'q' : 'due'), [filter, setFilter] = useState<string | null>(null), [msg, setMsg] = useState('')
  const [adding, setAdding] = useState<null | 'due' | 'exam'>(null), [posting, setPosting] = useState(false)
  const tags = courseTags.map((c) => courseOf(c) ?? c)
  const say = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 4000) }
  const fail = (e: unknown) => say(why(e))
  const col = (kind: 'due' | 'exam', title: string) => {
    const list = (items ?? []).filter((i) => i.kind === kind && (!filter || i.courseCode === filter))
    return (
      <section className={`bcol ${tab === kind ? 'on' : ''}`} aria-label={title}>
        <h3>{title}{can(role, 'addBoard') && <button type="button" className="plus" aria-label={`Add to ${title}`} onClick={() => setAdding(kind)}>+</button>}</h3>
        {list.length === 0 && <p className="none">Nothing yet</p>}
        <ul>{list.map((i) => {
          const mine = i.confirmedBy.includes(me), shown = i.userIds.slice(0, 5)
          return (
            <li key={i.key} className={`u-${urgency(i.dueAt, now)}`}>
              <span className="chip">{i.courseCode}</span> <b>{i.title}</b>
              <div className="meta">{day(i.dueAt)} · {when(i.dueAt, now)}</div>
              <div className="who">{shown.map((u) => <i key={u} title={by.get(u)?.name} style={{ background: hex(by.get(u)?.colour ?? 'snow') }}>{[...(by.get(u)?.name ?? '?')][0]}</i>)}{i.userIds.length > 5 && <em>+{i.userIds.length - 5}</em>}</div>
              <div className="acts">
                {can(role, 'interact') && <button type="button" aria-pressed={mine} onClick={() => (i.itemId ? confirmItem(slug, i.itemId, !mine) : addItem(slug, { kind: i.kind, courseCode: i.courseCode ?? '', title: i.title, date: new Date(i.dueAt + 7 * 3_600_000).toISOString().slice(0, 10), force: true })).then(onChanged, fail)}>{mine ? '✓ I have this' : 'I have this too'}</button>}
                {i.inPlanner ? <span className="in">✓ In your planner</span> : <button type="button" onClick={() => toPlanner(slug, i).then((r) => { say(r.already ? 'Already in your planner.' : 'Added. Desker will plan the work leading up to it.'); onChanged() }, fail)}>Add to my planner</button>}
                {i.itemId && (can(role, 'editAnyBoard') || i.createdBy === me) && <button type="button" className="del" aria-label="Delete this item" onClick={() => deleteItem(slug, i.itemId!).then(onChanged, fail)}>🗑</button>}
              </div>
            </li>
          )
        })}</ul>
      </section>
    )
  }
  return (
    <aside className="board wide" role="dialog" aria-label="Board">
      <h2>Board <button className="x" onClick={onClose} aria-label="Close">×</button></h2>
      <div className="filters" aria-label="Course filter">
        <button type="button" className={!filter ? 'on' : ''} aria-pressed={!filter} onClick={() => setFilter(null)}>All</button>
        {tags.map((c) => <button key={c} type="button" className={filter === c ? 'on' : ''} aria-pressed={filter === c} onClick={() => setFilter(filter === c ? null : c)}>{c}</button>)}
      </div>
      <div className="tabs" role="tablist">{TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {msg && <p className="bmsg" role="status">{msg}</p>}
      {items === null && <p>Reading the Board…</p>}
      {items && items.length === 0 && <p className="hint">Add a deadline with +, or share yours in Settings so the village can see what's coming.</p>}
      <div className="cols">
        {col('due', 'Due')}
        {col('exam', 'Exams')}
        <div className={`bcol ${tab === 'q' ? 'on' : ''}`}><Questions slug={slug} me={me} role={role} rev={rev} openId={openQ} /></div>
        <section className={`bcol ${tab === 'news' ? 'on' : ''}`} aria-label="News">
          <h3>News{can(role, 'announce') && <button type="button" className="plus" aria-label="Post an announcement" onClick={() => setPosting(true)}>+</button>}</h3>
          {news.length === 0 && <p className="none">No announcements.</p>}
          <ul>{news.map((a) => (
            <li key={a.id} className={a.pinned ? 'pinned' : ''}>
              <b>{a.pinned && '📌 '}{a.title}</b>
              {a.body && <p className="body">{a.body}</p>}
              <div className="meta">{a.by}{can(role, 'announce') && <button type="button" className="del" aria-label="Delete announcement" onClick={() => deleteItem(slug, a.id).then(onChanged, fail)}>🗑</button>}</div>
            </li>
          ))}</ul>
        </section>
      </div>
      {adding && <AddItem slug={slug} kind={adding} tags={tags} filter={filter} canTag={can(role, 'changeSettings')} onDone={(m) => { setAdding(null); if (m) say(m); onChanged() }} onClose={() => setAdding(null)} />}
      {posting && <Announce slug={slug} onDone={() => { setPosting(false); onChanged() }} onClose={() => setPosting(false)} />}
    </aside>
  )
}

function AddItem({ slug, kind: k0, tags, filter, canTag, onDone, onClose }: { slug: string; kind: 'due' | 'exam'; tags: string[]; filter: string | null; canTag: boolean; onDone: (msg?: string) => void; onClose: () => void }) {
  const [kind, setKind] = useState(k0), [tagList, setTagList] = useState(tags), [course, setCourse] = useState(filter ?? tags[0] ?? ''), [title, setTitle] = useState('')
  const [date, setDate] = useState(''), [time, setTime] = useState(''), [err, setErr] = useState(''), [dup, setDup] = useState<BoardItem | null>(null), [newTag, setNewTag] = useState(''), [busy, setBusy] = useState(false)
  const body = { kind, courseCode: course, title, date, ...(time && { time }) }
  const submit = (force = false) => { setBusy(true); addItem(slug, { ...body, force }).then(() => onDone('Added to the Board.'), (e: { code?: string; body?: { item?: BoardItem } }) => {
    setBusy(false); if (e.code === 'duplicate' && e.body?.item) return void setDup(e.body.item); setErr(why(e)) }) }
  const same = () => { setBusy(true); (dup?.itemId ? confirmItem(slug, dup.itemId, true) : addItem(slug, { ...body, force: true })).then(() => onDone('You are on that item now.'), (e) => { setBusy(false); setErr(why(e)) }) } // an item only some members share has no row yet: adding it makes mine
  const addTag = () => patchVillage(slug, { addCourse: newTag }).then(() => { const t = courseOf(newTag) ?? newTag.toUpperCase().replace(/\s+/g, ''); setTagList((l) => [...l, t]); setCourse(t); setNewTag('') }, () => setErr('That course code does not look right.'))
  return (
    <div className="hud-modal" role="dialog" aria-label="Add to the Board" onClick={onClose}>
      <form className="hud-panel add-item" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { e.nativeEvent.stopPropagation(); if (e.key === 'Escape') onClose() }} onSubmit={(e) => { e.preventDefault(); if (!busy && title.trim() && date && course) submit() }}>
        <h2>Add to the Board</h2>
        {dup ? <>
          <p><b>Looks like this is already on the Board.</b></p>
          <p className="row"><button type="button" disabled={busy} onClick={same}>That's it, I have it too</button> <button type="button" disabled={busy} onClick={() => submit(true)}>No, add mine</button></p>
        </> : <>
          <p role="radiogroup" aria-label="Kind"><label><input type="radio" checked={kind === 'due'} onChange={() => setKind('due')} /> Due</label> <label><input type="radio" checked={kind === 'exam'} onChange={() => setKind('exam')} /> Exam</label></p>
          <p className="chips" aria-label="Course">{tagList.map((c) => <button key={c} type="button" className={course === c ? 'on' : ''} aria-pressed={course === c} onClick={() => setCourse(c)}>{c}</button>)}
            {canTag && <span className="newtag"><input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="New course" aria-label="New course code" size={9} /><button type="button" disabled={!newTag.trim()} onClick={addTag}>Add</button></span>}</p>
          <p><input autoFocus value={title} onChange={(e) => setTitle([...e.target.value].slice(0, 120).join(''))} placeholder="Title, like Static quiz" aria-label="Title" autoComplete="off" /></p>
          <p className="row"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" /> <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time (optional)" /></p>
          <p className="row"><button type="submit" disabled={busy || !title.trim() || !date || !course}>Add</button> <button type="button" onClick={onClose}>Cancel</button></p>
        </>}
        {err && <p role="alert" className="err">{err}</p>}
      </form>
    </div>
  )
}

function Announce({ slug, onDone, onClose }: { slug: string; onDone: () => void; onClose: () => void }) {
  const [title, setTitle] = useState(''), [body, setBody] = useState(''), [pinned, setPinned] = useState(false), [err, setErr] = useState('')
  return (
    <div className="hud-modal" role="dialog" aria-label="Post an announcement" onClick={onClose}>
      <form className="hud-panel add-item" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { e.nativeEvent.stopPropagation(); if (e.key === 'Escape') onClose() }} onSubmit={(e) => { e.preventDefault(); if (title.trim()) announce(slug, { title, body, pinned }).then(onDone, (x) => setErr(why(x))) }}>
        <h2>Post an announcement</h2>
        <p><input autoFocus value={title} onChange={(e) => setTitle([...e.target.value].slice(0, 120).join(''))} placeholder="Title" aria-label="Title" autoComplete="off" /></p>
        <p><textarea value={body} onChange={(e) => setBody([...e.target.value].slice(0, 500).join(''))} placeholder="Details (optional)" aria-label="Details" rows={3} /> <span className="count">{[...body].length}/500</span></p>
        <p><label><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Pin to the top</label></p>
        <p className="row"><button type="submit" disabled={!title.trim()}>Post</button> <button type="button" onClick={onClose}>Cancel</button></p>
        {err && <p role="alert" className="err">{err}</p>}
      </form>
    </div>
  )
}
