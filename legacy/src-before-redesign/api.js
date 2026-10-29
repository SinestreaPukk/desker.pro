// Anonymous per-browser id: scopes saved data without accounts.
export const uid = localStorage.uid || (localStorage.uid = crypto.randomUUID())
export const stateUrl = `/api/state?uid=${uid}`

// POST JSON to an /api endpoint. Always throws an Error with a message that is fine to show.
export async function post(path, body) {
  let res
  try {
    res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-uid': uid }, body: JSON.stringify(body) })
  } catch {
    throw new Error('No connection. Check your internet and try again.')
  }
  const out = await res.json().catch(() => null)
  if (!res.ok || out === null) throw new Error(out?.error || 'Something went wrong. Please try again.')
  return out
}
