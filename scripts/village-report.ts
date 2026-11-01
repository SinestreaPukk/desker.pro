// The Phase 0 gate report: per village per day, unique members, sessions, minutes present, focus minutes, bubbles, and whether 3+ members were present at the same time.
//   set -a; . ./.env.local; set +a; node scripts/village-report.ts [days=14]
// Reads village_event (SPEC §13). Days are Bangkok days.
export interface Ev { village: string; user: string; name: string; props: Record<string, number>; at: number } // at: epoch ms
export interface Row { village: string; day: string; members: number; sessions: number; minutesPresent: number; focusMinutes: number; bubbles: number; threeTogether: boolean }

const day = (ms: number) => new Date(ms + 7 * 3_600_000).toISOString().slice(0, 10)
/** True if at any moment three different members were present (each session_minutes event covers the minutes before it). */
export function threeTogether(spans: { user: string; from: number; to: number }[]): boolean {
  const edges = spans.flatMap((s) => [{ t: s.from, d: 1, u: s.user }, { t: s.to, d: -1, u: s.user }]).sort((a, b) => a.t - b.t || a.d - b.d) // leaves before joins at the same instant
  const here = new Map<string, number>()
  for (const e of edges) {
    here.set(e.u, (here.get(e.u) ?? 0) + e.d)
    if (here.get(e.u) === 0) here.delete(e.u)
    if (here.size >= 3) return true
  }
  return false
}

export function buildReport(events: Ev[]): Row[] {
  const groups = new Map<string, Ev[]>()
  for (const e of events) { const k = `${e.village}|${day(e.at)}`; groups.set(k, [...(groups.get(k) ?? []), e]) }
  return [...groups].map(([k, list]) => {
    const [village, d] = k.split('|'), mins = list.filter((e) => e.name === 'session_minutes')
    return {
      village, day: d, members: new Set(list.map((e) => e.user)).size,
      sessions: list.filter((e) => e.name === 'village_opened').length,
      minutesPresent: mins.reduce((a, e) => a + (e.props.minutes ?? 0), 0), focusMinutes: mins.reduce((a, e) => a + (e.props.focusMinutes ?? 0), 0),
      bubbles: list.filter((e) => e.name === 'bubble_sent').length,
      threeTogether: threeTogether(mins.map((e) => ({ user: e.user, from: e.at - (e.props.minutes ?? 0) * 60_000, to: e.at }))),
    }
  }).sort((a, b) => a.village.localeCompare(b.village) || a.day.localeCompare(b.day))
}

if (process.argv[1]?.endsWith('village-report.ts')) {
  const { neon } = await import('@neondatabase/serverless')
  const sql = neon(process.env.DATABASE_URL!), days = Number(process.argv[2]) || 14
  const rows = await sql.query(
    `select v.slug as village, e.user_id as "user", e.name, e.props, extract(epoch from e.created_at) * 1000 as at
       from village_event e join village v on v.id = e.village_id where e.created_at > now() - ($1 || ' days')::interval`, [String(days)])
  const report = buildReport(rows.map((r) => ({ ...r, at: Number(r.at) }) as Ev))
  console.log(['village', 'day', 'members', 'sessions', 'min present', 'focus min', 'bubbles', '3+ together'].join('\t'))
  for (const r of report) console.log([r.village, r.day, r.members, r.sessions, r.minutesPresent, r.focusMinutes, r.bubbles, r.threeTogether ? 'yes' : 'no'].join('\t'))
  if (!report.length) console.log('(no events yet)')
}
