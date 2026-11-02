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

// ---- Phase 1 gate: cohorts of villages by the week they were created (`--cohort`) ----
export interface CVillage { id: string; slug: string; createdAt: number }
export interface CMember { village: string; user: string; joinedAt: number }
export interface CEvent { village: string; user: string; name: string; props: Record<string, number>; at: number }
export interface CohortRow { week: string; villages: number; size7: number | null; size14: number | null; size28: number | null; active: (number | null)[]; gate: number | null; togetherPerActive: number | null; invites: { created: number; accepted: number }; toPlanner: number; groupsPerVillageWeek: number | null; bubblesPerFocusHour: number | null }
const DAY = 86_400_000, WEEK = 7 * DAY
const monday = (ms: number) => { const d = new Date(ms + 7 * 3_600_000); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10) }
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
/** togetherMin: minutes studied in study-together rounds, per village and user, with the time they ended. */
export function buildCohort(villages: CVillage[], members: CMember[], events: CEvent[], togetherMin: { village: string; user: string; minutes: number; at: number }[], now = Date.now()): CohortRow[] {
  const weeks = new Map<string, CVillage[]>()
  for (const v of villages) weeks.set(monday(v.createdAt), [...(weeks.get(monday(v.createdAt)) ?? []), v])
  return [...weeks].sort((a, b) => a[0].localeCompare(b[0])).map(([week, vs]) => {
    const ids = new Set(vs.map((v) => v.id)), age = (v: CVillage) => (now - v.createdAt) / DAY
    const size = (n: number) => { const old = vs.filter((v) => age(v) >= n); return old.length ? avg(old.map((v) => members.filter((m) => m.village === v.id && m.joinedAt <= v.createdAt + n * DAY).length)) : null }
    // weekly active = at least 3 minutes present in village week k (k = 1..4, counted from creation)
    const activeIn = (v: CVillage, k: number) => new Set(events.filter((e) => e.village === v.id && e.name === 'session_minutes' && e.at >= v.createdAt + (k - 1) * WEEK && e.at < v.createdAt + k * WEEK).reduce((m, e) => m.set(e.user, (m.get(e.user) ?? 0) + (e.props.minutes ?? 0)), new Map<string, number>()).entries().filter(([, min]) => min >= 3).map(([u]) => u)).size
    const active = [1, 2, 3, 4].map((k) => { const old = vs.filter((v) => age(v) >= k * 7); return old.length ? avg(old.map((v) => activeIn(v, k))) : null })
    const w4 = vs.filter((v) => age(v) >= 28)
    const gate = w4.length ? (100 * w4.filter((v) => activeIn(v, 4) >= 3).length) / w4.length : null
    const mine = events.filter((e) => ids.has(e.village)), count = (n: string) => mine.filter((e) => e.name === n).length
    const perActive: number[] = []
    for (const v of vs) for (let k = 1; k <= 4; k++) { const a = activeIn(v, k); if (!a || age(v) < k * 7) continue; perActive.push(togetherMin.filter((t) => t.village === v.id && t.at >= v.createdAt + (k - 1) * WEEK && t.at < v.createdAt + k * WEEK).reduce((s, t) => s + t.minutes, 0) / a) }
    const focusH = mine.filter((e) => e.name === 'session_minutes').reduce((s, e) => s + (e.props.focusMinutes ?? 0), 0) / 60
    const vWeeks = vs.reduce((s, v) => s + Math.max(1, age(v) / 7), 0)
    return { week, villages: vs.length, size7: size(7), size14: size(14), size28: size(28), active, gate, togetherPerActive: avg(perActive), invites: { created: count('invite_created'), accepted: count('invite_accepted') }, toPlanner: count('board_item_to_planner'), groupsPerVillageWeek: vWeeks ? count('group_started') / vWeeks : null, bubblesPerFocusHour: focusH ? count('bubble_sent') / focusH : null }
  })
}

if (process.argv[1]?.endsWith('village-report.ts') && process.argv.includes('--cohort')) {
  const { neon } = await import('@neondatabase/serverless')
  const sql = neon(process.env.DATABASE_URL!), n = (x: number | null, d = 1) => (x == null ? '-' : x.toFixed(d))
  const vs = (await sql.query('select id, slug, extract(epoch from created_at) * 1000 as at from village where deleted_at is null')).map((r) => ({ id: r.id, slug: r.slug, createdAt: Number(r.at) }))
  const ms = (await sql.query('select village_id as village, user_id as "user", extract(epoch from joined_at) * 1000 as at from village_member where banned_at is null')).map((r) => ({ village: r.village, user: r.user, joinedAt: Number(r.at) }))
  const ev = (await sql.query("select village_id as village, user_id as \"user\", name, props, extract(epoch from created_at) * 1000 as at from village_event where name in ('session_minutes','invite_created','invite_accepted','board_item_to_planner','group_started','bubble_sent')")).map((r) => ({ ...r, at: Number(r.at) }) as CEvent)
  const tg = (await sql.query('select village_id as village, user_id as "user", extract(epoch from (ended_at - started_at)) / 60 as minutes, extract(epoch from ended_at) * 1000 as at from village_focus_session where group_session_id is not null and ended_at is not null')).map((r) => ({ village: r.village, user: r.user, minutes: Math.min(Number(r.minutes), 180), at: Number(r.at) }))
  const rows = buildCohort(vs, ms, ev, tg)
  console.log(['cohort', 'villages', 'size d7', 'd14', 'd28', 'active w1', 'w2', 'w3', 'w4', 'GATE % (3+ active in w4)', 'together min/active/wk', 'invites c>a', 'to planner', 'groups/village/wk', 'bubbles/focus h'].join('\t'))
  for (const r of rows) console.log([r.week, r.villages, n(r.size7), n(r.size14), n(r.size28), ...r.active.map((a) => n(a)), n(r.gate, 0), n(r.togetherPerActive), `${r.invites.created}>${r.invites.accepted}`, r.toPlanner, n(r.groupsPerVillageWeek), n(r.bubblesPerFocusHour)].join('\t'))
  if (!rows.length) console.log('(no villages yet)')
  process.exit(0)
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
