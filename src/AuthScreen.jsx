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
  const [sentTo, setSentTo] = useState('') // set after sign-up (or sign-in while unverified): shows the check-your-inbox screen
  const [social, setSocial] = useState([])
  useEffect(() => { fetch('/api/auth/providers').then((r) => r.json()).then(setSocial).catch(() => {}) }, [])
  const go = (m) => { setMode(m); setMsg('') }

  const submit = async (e) => {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.target))
    setBusy(true); setMsg('')
    const { data, error } = await (mode === 'in' ? authClient.signIn.email({ email: f.email, password: f.password, callbackURL: '/today' })
      : mode === 'up' ? authClient.signUp.email({ name: f.name, email: f.email, password: f.password, callbackURL: '/today' })
      : mode === 'forgot' ? authClient.requestPasswordReset({ email: f.email, redirectTo: '/reset-password' })
      : authClient.resetPassword({ newPassword: f.password, token }))
    setBusy(false)
    if (error?.code === 'EMAIL_NOT_VERIFIED') return setSentTo(f.email) // sign-in sent a fresh link already
    if (error) return setMsg(error.status === 429 ? 'Too many tries. Wait a little and try again.' : error.message || 'Something went wrong.')
    if (mode === 'forgot') return setMsg('If that email has an account, a reset link is on its way.')
    if (mode === 'reset') { history.replaceState(null, '', '/today'); return go('in'), setMsg('Password changed. Sign in with the new one.') }
    if (mode === 'up' && !data?.token) setSentTo(f.email) // with no mail provider the session starts at once and this screen disappears
  }

  if (sentTo) return <CheckInbox email={sentTo} back={() => { setSentTo(''); go('in') }} />
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

function CheckInbox({ email, back }) {
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const resend = async () => {
    setBusy(true); setMsg('')
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: '/today' })
    setBusy(false)
    setMsg(error ? (error.status === 429 ? 'Too many emails requested. Wait a while and try again.' : error.message || 'Could not send. Try again.') : 'Sent again. It can take a minute to arrive.')
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-4">
      <div className="flex items-center gap-3"><Avatar /><h1 className="text-2xl">Desker</h1></div>
      <section className={`${panel} space-y-3`} aria-label="Check your inbox">
        <h2 className="text-xl">Check your inbox</h2>
        <p>We sent a confirmation link to <strong className="[overflow-wrap:anywhere]">{email}</strong>.</p>
        <p>Open the email and tap <strong>Confirm your email</strong> to verify your address. You will be signed in automatically.</p>
        <p className="text-sm text-slate-700">Nothing there after a minute? Look in spam or promotions, or send it again.</p>
        <button className={`${btn} ${BLUE} w-full`} onClick={resend} disabled={busy}>{busy ? 'One moment…' : 'Send the email again'}</button>
        {msg && <p role="status" className="text-base">{msg}</p>}
      </section>
      <button className={`${btn} ${ghost}`} onClick={back}>Back to sign in</button>
    </main>
  )
}
