// Sign-up form rules, mirrored by the server (username plugin 3-30 of letters, numbers, _ and .; password 10-128). Returns { field: message }.
export function checkSignUp({ name = '', username = '', email = '', password = '', confirm = '' }) {
  const e = {}
  if (!name.trim()) e.name = 'Tell us what to call you.'
  else if (name.trim().length > 60) e.name = 'Keep your name under 60 characters.'
  if (!/^[A-Za-z0-9_.]{3,30}$/.test(username)) e.username = 'Use 3 to 30 letters, numbers, dots or underscores.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) e.email = 'Enter a valid email address.'
  if (password.length < 10) e.password = 'Use at least 10 characters. A few words in a row works well.'
  else if (password.length > 128) e.password = 'Use 128 characters or fewer.'
  if (!e.password && confirm !== password) e.confirm = 'The two passwords do not match.'
  return e
}

// Welcome questions (src/Welcome.jsx). Stored on the account as data.onboarding.
export const WHO = ['School or studies', 'Work', 'My own projects', 'A bit of everything']
export const WANTS = ['Never miss a deadline', 'Plan my week', 'Break big goals into steps', 'Stay focused', 'Balance work and rest', 'Know what to do next']
