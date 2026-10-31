// What the kodama remembers: short notes made only from things the user said or did (an answer to "how did the quiz go?", a note they typed).
// The user can read, edit and delete every one of them, and they are handed to the AI together with the rhythm summary. Pure functions over the document.
export const MAX_NOTES = 60, MAX_LEN = 200
export const notesOf = (data) => data?.kodama?.notes || []
export const cleanNote = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN)

const withNotes = (data, notes) => ({ ...data, kodama: { ...data.kodama, notes: notes.slice(-MAX_NOTES) } })
const idFor = (at) => `${at}-${Math.floor(Math.random() * 1e4)}`

export function addNote(data, text, src = 'said', at = Date.now()) {
  const t = cleanNote(text)
  return t ? withNotes(data, [...notesOf(data), { id: idFor(at), text: t, at, src }]) : data
}
// An edit replaces the note under a new id, so two devices that change the same list merge instead of overwriting each other (see src/sync.js).
export function editNote(data, id, text) {
  const t = cleanNote(text), old = notesOf(data).find((n) => n.id === id)
  if (!old) return data
  if (!t) return removeNote(data, id)
  return withNotes(data, notesOf(data).map((n) => (n.id === id ? { ...old, id: idFor(old.at), text: t } : n)))
}
export const removeNote = (data, id) => withNotes(data, notesOf(data).filter((n) => n.id !== id))
export const clearNotes = (data) => withNotes(data, [])

// For the AI: the newest notes, one short line each, with their date.
export const notesForAI = (data, n = 30) => notesOf(data).slice(-n).map((x) => `${new Date(x.at).toLocaleDateString('sv')}: ${x.text}`)
