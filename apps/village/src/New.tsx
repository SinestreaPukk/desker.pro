import { useEffect, useState } from 'react'
import { cleanCreate, slugSuggest, tagOf, MAX_COURSE_TAGS } from '@desker/shared'
import { createVillage, myCourses } from './api.ts'

const MSG: Record<string, string> = {
  bad_name: 'Give it a name of 3 to 40 characters.',
  bad_slug: 'The address needs 3 to 40 letters, numbers or single hyphens.',
  slug_taken: 'That address is taken. Try another.',
  too_many_owned: 'You already own 5 villages. Close one first.',
  too_many_joined: "You're in 20 villages already. Leave one first.",
}

// /new: name, courses, rules. Three small steps; the owner lands in the world when it is made.
export default function New() {
  const [step, setStep] = useState(0)
  const [name, setName] = useState(''), [slug, setSlug] = useState(''), [slugEdited, setSlugEdited] = useState(false)
  const [courses, setCourses] = useState<string[]>([]), [typed, setTyped] = useState(''), [suggest, setSuggest] = useState<string[]>([])
  const [whoCanInvite, setWho] = useState<'admins' | 'everyone'>('admins'), [libraryAutoFocus, setLib] = useState(true), [defaultSharing, setSharing] = useState<'basic' | 'full'>('basic')
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { myCourses().then((r) => setSuggest(r.courses)).catch(() => {}) }, [])

  const addCourse = (c: string) => { const t = tagOf(c); if (/^[A-Z0-9]{2,12}$/.test(t) && !courses.includes(t) && courses.length < MAX_COURSE_TAGS) setCourses([...courses, t]); setTyped('') }
  const body = { name, slug, courses, whoCanInvite, libraryAutoFocus, defaultSharing }
  const next = () => {
    const c = cleanCreate(body)
    if (step === 0 && !c.ok) return setErr(MSG[c.error])
    setErr(''); setStep(step + 1)
  }
  const create = async () => {
    setBusy(true); setErr('')
    try { const r = await createVillage(body); location.assign(`/v/${r.slug}?new=1`) }
    catch (e) { const code = (e as { code?: string }).code ?? ''; setErr(MSG[code] ?? 'Something went wrong. Try again.'); setBusy(false); if (code === 'slug_taken' || code === 'bad_slug' || code === 'bad_name') setStep(0) }
  }

  return (
    <main className="pad new">
      <p><a href="/">← Your villages</a></p>
      <h1>New village <small>step {step + 1} of 3</small></h1>
      {step === 0 && (
        <>
          <label>Name<input value={name} maxLength={40} autoFocus onChange={(e) => { setName(e.target.value); if (!slugEdited) setSlug(slugSuggest(e.target.value)) }} /></label>
          <label>Address<input value={slug} maxLength={40} onChange={(e) => { setSlugEdited(true); setSlug(e.target.value.toLowerCase()) }} /><small>village.desker.dev/v/{slug || '…'}</small></label>
          <div className="cards">
            <div className="card on"><b>Snowy Campus</b><span>Library, tables, lounge, garden</span></div>
            <div className="card off" aria-disabled="true"><b>Tea House</b><span>Coming soon</span></div>
            <div className="card off" aria-disabled="true"><b>Night Library</b><span>Coming soon</span></div>
          </div>
        </>
      )}
      {step === 1 && (
        <>
          <p>Which courses does this group share? Their deadlines show on the Board.</p>
          <div className="chips">{courses.map((c) => <button key={c} onClick={() => setCourses(courses.filter((x) => x !== c))} aria-label={`Remove ${c}`}>{c} ×</button>)}</div>
          <label>Add a course<input value={typed} placeholder="DTIP 122" onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addCourse(typed) } }} /></label>
          {suggest.filter((c) => !courses.includes(tagOf(c))).length > 0 && <div className="chips">From your planner: {suggest.filter((c) => !courses.includes(tagOf(c))).map((c) => <button key={c} onClick={() => addCourse(c)}>+ {c}</button>)}</div>}
          <p><small>You can skip this and add courses later.</small></p>
        </>
      )}
      {step === 2 && (
        <>
          <fieldset><legend>Who can invite friends?</legend>
            <label><input type="radio" checked={whoCanInvite === 'admins'} onChange={() => setWho('admins')} /> Owner and admins</label>
            <label><input type="radio" checked={whoCanInvite === 'everyone'} onChange={() => setWho('everyone')} /> Everyone</label></fieldset>
          <label><input type="checkbox" checked={libraryAutoFocus} onChange={(e) => setLib(e.target.checked)} /> Walking into the Library turns Focus on</label>
          <fieldset><legend>What new members share about their studying</legend>
            <label><input type="radio" checked={defaultSharing === 'basic'} onChange={() => setSharing('basic')} /> Just "Studying" (basic)</label>
            <label><input type="radio" checked={defaultSharing === 'full'} onChange={() => setSharing('full')} /> Subject and task (full)</label></fieldset>
        </>
      )}
      {err && <p role="alert">{err}</p>}
      <p className="row">
        {step > 0 && <button onClick={() => setStep(step - 1)} disabled={busy}>Back</button>}
        {step < 2 ? <button onClick={next}>Next</button> : <button onClick={create} disabled={busy}>{busy ? 'Making it…' : 'Create village'}</button>}
      </p>
    </main>
  )
}
