// Helpers around the AI's replan answer: validate it, show what changes, and flag deadline risks.
const DATE = /^\d{4}-\d\d-\d\d$/, TIME = /^\d\d:\d\d$/
const day = (d) => d.toLocaleDateString('sv')
const diffDays = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 864e5)

// Keep only plan items for known open tasks, dated today or later, at most one per task.
export function validPlan(plan, tasks, today = day(new Date())) {
  const open = new Map(tasks.filter((t) => !t.done && !t.fun).map((t) => [t.id, t]))
  const seen = new Set()
  return (Array.isArray(plan) ? plan : []).filter((p) => open.has(p?.id) && !seen.has(p.id) && seen.add(p.id) && DATE.test(p.when) && p.when >= today)
    .map((p) => ({ id: p.id, when: p.when, start: TIME.test(p.start) ? p.start : undefined }))
}

// What changes: moved (any change), pushedBack (later day than before), fresh (had no day before).
export function diff(tasks, plan) {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const moved = plan.flatMap((p) => {
    const t = byId.get(p.id)
    if (t.when === p.when && (t.start || '') === (p.start || '')) return []
    return [{ t, to: p, fresh: !t.when, pushedBack: !!t.when && p.when > t.when }]
  })
  return { moved, pushedBack: moved.filter((m) => m.pushedBack), fresh: moved.filter((m) => m.fresh) }
}

export const applyPlan = (tasks, plan) => tasks.map((t) => { const p = plan.find((x) => x.id === t.id); return p ? { ...t, when: p.when, start: p.start } : t })

// Deadline risks for a schedule: tasks planned after (or left past) their due date, and deadlines needing more hours than free time allows.
export function risks(tasks, deadlines, freeHours, today = day(new Date())) {
  const out = []
  for (const t of tasks) {
    if (t.done || t.fun || !t.due) continue
    if (t.when && t.when > t.due) out.push({ title: t.title, why: `planned ${t.when}, after its due date ${t.due}` })
    else if (!t.when && t.due < today) out.push({ title: t.title, why: `overdue since ${t.due} and not scheduled` })
  }
  if (freeHours > 0) for (const d of deadlines) {
    const left = diffDays(today, d.date)
    if (left < 0 || d.done) continue
    const need = tasks.filter((t) => t.deadlineId === d.id && !t.done).reduce((n, t) => n + (t.hours || 1), 0)
    const cap = freeHours * (left + 1)
    if (need > cap) out.push({ title: d.title, why: `needs about ${need}h but only about ${cap}h of free time is left before ${d.date}` })
  }
  return out
}
