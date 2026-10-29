// Four ways to pick what to do next. Each returns the best open task (or undefined) with a one-line reason.
// A task's quadrant: 0 Do First, 1 Schedule, 2 Batch/minimize, 3 Eliminate; undefined = not ranked yet.
const q = (t) => (t.important === undefined ? undefined : (t.important ? 0 : 2) + (t.urgent ? 0 : 1))
const open = (tasks) => tasks.filter((t) => !t.done && !t.fun)
const best = (list, ...keys) => [...list].sort((a, b) => { for (const k of keys) { const d = k(a) - k(b); if (d) return d } return 0 })[0]
const date = (t) => (t.due ? Date.parse(t.due) : Infinity)
const hrs = (t) => t.hours || 1

export const METHODS = [
  { name: 'Eisenhower', how: 'Most urgent and important first',
    pick: (tasks) => { const t = best(open(tasks), (t) => q(t) ?? 4, date); return t && { t, why: q(t) === undefined ? 'Earliest due date (not ranked yet).' : ['Urgent and important.', 'Important, not urgent yet.', 'Urgent but not important.', 'Neither urgent nor important.'][q(t)] } } },
  { name: 'Eat the Frog', how: 'The big one you would rather dodge',
    pick: (tasks) => { const t = best(open(tasks), (t) => (q(t) ?? 1) < 2 ? 0 : 1, (t) => t.happy ?? 50, (t) => -hrs(t)); return t && { t, why: 'Important, big and the one you feel least like doing. Do it first.' } } },
  { name: 'Quick wins', how: 'Most value for the least effort',
    pick: (tasks) => { const t = best(open(tasks), (t) => -([4, 3, 2, 1][q(t)] ?? 2) / hrs(t)); return t && { t, why: `Worth the most per hour${t.hours ? ` (${t.hours}h)` : ''}.` } } },
  { name: 'Fits my energy', how: 'Matches your free minutes and energy',
    pick: (tasks, { minutes = 60, energy = 'medium' } = {}) => {
      const fits = open(tasks).filter((t) => !t.hours || t.hours * 60 <= minutes)
      const t = energy === 'low' ? best(fits, (t) => -(t.happy ?? 50), hrs) : energy === 'high' ? best(fits, (t) => q(t) ?? 4, (t) => -hrs(t)) : best(fits, (t) => q(t) ?? 4, hrs)
      return t && { t, why: { low: 'Light and enjoyable for a low-energy moment.', medium: 'Fits your time and matters.', high: 'Demanding and important: use the energy.' }[energy] } } },
]
