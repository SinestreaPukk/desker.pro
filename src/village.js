// Kodama Village's side of desker.dev: who is studying there, my hours with friends, my village data for the export.
// Every call fails quietly (null): the village being down or a person not being in one must never break a Desker screen.
const base = () => (/(^|\.)desker\.dev$/.test(location.hostname) ? 'https://village.desker.dev' : 'http://village.desker.test:5174')
export const villageUrl = base
const get = (path, ms = 4000) => fetch(`${base()}/api/village/${path}`, { credentials: 'include', signal: AbortSignal.timeout(ms) }).then((r) => (r.ok ? r.json() : null), () => null)
export const villageSummary = () => get('summary')
export const villageExport = () => get('export', 8000)
