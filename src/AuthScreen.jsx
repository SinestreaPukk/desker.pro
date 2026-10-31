import { useState, useEffect } from 'react'
import { authClient } from './auth.js'
import { btn, BLUE, ghost, input, panel } from './ui.js'
import { Avatar } from './px.jsx'

// One card, four modes. A reset link opens in 'reset' with its token.
const token = new URLSearchParams(location.search).get('token')
const WORDS = {
  in: ['Sign in', 'Sign in'],
  up: ['Create your account', 'Sign up'],
  forgot: ['Reset your password', 'Send reset link'],
  reset: ['Choose a new password', 'Save new password'],
}

export default function AuthScreen() {
  const [mode, setMode] = useState(location.pathname === '/reset-password' && token ? 'reset' : 'in')
  const [msg, setMsg] = useState(new URLSearchParams(location.search).get('error') ? 'That link is invalid or has expired. Ask for a new one.' : '')
  const [busy, setBusy] = useState(false)
  const [social, setSocial] = useState([])
  useEffect(() => { fetch('/api/providers').then((r) => r.json()).then(setSocial).catch(() => {}) }, [])
  const go = (m) => { setMode(m); setMsg('') }

  const submit = async (e) => {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.target))
    setBusy(true); setMsg('')
    const { error } = await (mode === 'in' ? authClient.signIn.email({ email: f.email, password: f.password })
      : mode === 'up' ? authClient.signUp.email({ name: f.name, email: f.email, password: f.password })
      : mode === 'forgot' ? authClient.requestPasswordReset({ email: f.email, redirectTo: '/reset-password' })
      : authClient.resetPassword({ newPassword: f.password, token }))
    setBusy(false)
    if (error) return setMsg(error.status === 429 ? 'Too many tries. Wait a little and try again.' : error.message || 'Something went wrong.')
    if (mode === 'forgot') return setMsg('If that email has an account, a reset link is on its way.')
    if (mode === 'reset') { history.replaceState(null, '', '/today'); return go('in'), setMsg('Password changed. Sign in with the new one.') }
    if (mode === 'up') return setMsg('Check your email to confirm your address, then sign in.') // with no mail provider the session starts at once and this screen disappears
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-4">
      <div className="flex items-center gap-3"><Avatar /><h1 className="text-2xl">Desker</h1></div>
      <form onSubmit={submit} className={`${panel} space-y-3`} aria-label={WORDS[mode][0]}>
        <h2 className="text-xl">{WORDS[mode][0]}</h2>
        {mode === 'up' && <input name="name" required autoComplete="name" className={`${input} w-full`} placeholder="Your name" aria-label="Your name" />}
        {mode !== 'reset' && <input name="email" type="email" required autoComplete="email" className={`${input} w-full`} placeholder="Email" aria-label="Email" />}
        {mode !== 'forgot' && <input name="password" type="password" required minLength={mode === 'in' ? 1 : 10} maxLength={128} autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          className={`${input} w-full`} placeholder={mode === 'in' ? 'Password' : 'Password (10+ characters)'} aria-label="Password" />}
        <button className={`${btn} ${BLUE} w-full`} disabled={busy}>{busy ? 'One moment…' : WORDS[mode][1]}</button>
        {msg && <p role="status" className="text-base">{msg}</p>}
      </form>
      {mode !== 'forgot' && mode !== 'reset' && social.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {social.map((p) => <button key={p} className={`${btn} ${ghost} flex-1 capitalize`} onClick={() => authClient.signIn.social({ provider: p, callbackURL: '/today', errorCallbackURL: '/today?error=1' })}>Continue with {p}</button>)}
        </div>
      )}
      <div className="flex flex-wrap justify-between gap-2 text-base">
        {mode === 'in' && <><button className={`${btn} ${ghost}`} onClick={() => go('up')}>Create an account</button><button className={`${btn} ${ghost}`} onClick={() => go('forgot')}>Forgot password?</button></>}
        {mode !== 'in' && <button className={`${btn} ${ghost}`} onClick={() => go('in')}>Back to sign in</button>}
      </div>
    </main>
  )
}
