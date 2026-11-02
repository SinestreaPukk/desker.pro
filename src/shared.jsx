import { post } from './api.js'
import { encodeFile } from './files.js'
import { rankedGoals } from './goals.js'

// What the AI is told about each goal.
export const goalsForAI = (goals) => rankedGoals(goals).map((g, i) => ({ id: g.id, rank: i + 1, title: g.title, area: g.area }))

// Photos, PDFs, text files and web pages -> plain notes the chat can use.
export async function readSource({ file, url }) {
  let body = { url }
  if (!url) {
    body = await encodeFile(file)
    if (body.text !== undefined) return body.text.slice(0, 6000)
  }
  return (await post('/api/read', body)).text
}

export async function importCalendar(body) {
  return (await post('/api/import', body)).events
}

export const REPEATS = [['', 'Never'], ['daily', 'Daily'], ['weekdays', 'Weekdays'], ['weekly', 'Weekly'], ['monthly', 'Monthly']]
export const todayStr = () => new Date().toLocaleDateString('sv')
export const QUICK = ['Weekly review', 'Find my goals']

// "Fri 31 Oct" from yyyy-mm-dd
export const fmtDate = (d) => (d ? new Date(`${d}T00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '') : '')
