export const stateUrl = '/api/state'

// POST JSON to an /api endpoint (the session cookie goes along). Always throws an Error with a message that is fine to show.
export async function post(path, body) {
  let res
  try {
    res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new Error('No connection. Check your internet and try again.')
  }
  const out = await res.json().catch(() => null)
  if (!res.ok || out === null) throw new Error(out?.error || 'Something went wrong. Please try again.')
  return out
}
