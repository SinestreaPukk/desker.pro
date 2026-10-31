// Sign-up form rules, mirrored by the server (username plugin 3-30 of letters, numbers, _ and .; password 10-128). Returns { field: message }.
// Sign-up asks for email and password only; name and username are derived from the email (see deriveAccount) unless given.
export function checkSignUp({ name, username, email = '', password = '', confirm }) {
  const e = {}
  if (name !== undefined && !name.trim()) e.name = 'Tell us what to call you.'
  else if (name && name.trim().length > 60) e.name = 'Keep your name under 60 characters.'
  if (username !== undefined && !/^[A-Za-z0-9_.]{3,30}$/.test(username)) e.username = 'Use 3 to 30 letters, numbers, dots or underscores.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) e.email = 'Enter a valid email address.'
  if (password.length < 10) e.password = 'Use at least 10 characters. A few words in a row works well.'
  else if (password.length > 128) e.password = 'Use 128 characters or fewer.'
  if (confirm !== undefined && !e.password && confirm !== password) e.confirm = 'The two passwords do not match.'
  return e
}

// "mika.tanaka+uni@x.edu" -> { name: 'Mika', username: 'mika.tanakauni' }. `n` adds a numeric suffix for when the username is taken.
export function deriveAccount(email, n = 0) {
  const local = String(email).trim().split('@')[0].toLowerCase()
  const clean = local.replace(/[^a-z0-9_.]/g, '')
  const base = (clean.length >= 3 ? clean : `${clean}user`.padEnd(3, 'x')).slice(0, 30)
  const username = n ? `${base.slice(0, 30 - String(n).length)}${n}` : base
  const word = local.split(/[^a-z]+/).find(Boolean)
  return { name: word ? word[0].toUpperCase() + word.slice(1) : 'Student', username }
}
