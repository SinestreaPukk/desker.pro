import { useState, useEffect, useId } from 'react'
import { authClient } from './auth.js'
import { checkSignUp } from './authForm.js'
import { btn, BLUE, ghost, input, panel } from './ui.js'
import { Avatar } from './px.jsx'
import Wallpaper from './Wallpaper.jsx'

// A split screen: a cosy pixel city on the left (a different one per step), the form on the right.
// A reset link opens in 'reset' with its token. Modes: in, up, forgot, reset; then the check-your-inbox step after sign-up.
const params = new URLSearchParams(location.search)
const token = params.get('token')
const SCENE = {
  in: ['dusk', 'Evening lights are on', 'Welcome back. Your desk is just as you left it.'],
  up: ['dawn', 'A fresh morning', 'Let us set up your desk. It takes a minute.'],
  forgot: ['rain', 'A rainy day in the city', 'It happens to everyone. We will get you back in.'],
  reset: ['rain', 'A rainy day in the city', 'Pick a new password and you are good to go.'],
  sent: ['snow', 'Snow is falling', 'Your confirmation email is on its way.'],
}
const TITLE = { in: 'Welcome back', up: 'Create your account', forgot: 'Forgot your password?', reset: 'Choose a new password' }
const GO = { in: 'Sign in', up: 'Create account', forgot: 'Email me a reset link', reset: 'Save new password' }

export function Shell({ kind, children }) {
  const [scene, label, caption] = SCENE[kind]
  return (
    <div className="min-h-screen md:grid md:grid-cols-2">
      <aside className="relative h-36 md:sticky md:top-0 md:h-screen">
        <Wallpaper scene={scene} label={label} />
        <p className="px-panel absolute left-3 right-3 top-3 hidden max-w-sm p-3 text-base md:block">{caption}</p>
      </aside>
      <main className="flex min-h-[calc(100vh-9rem)] items-center justify-center p-5 md:min-h-screen md:p-10">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center gap-3"><Avatar /><span className="text-2xl">Desker</span></div>
          {children}
        </div>
      </main>
    </div>
  )
}

// Label above, hint or error below. Passwords get a Show / Hide button inside the box.
function Field({ label, name, error, hint, secret, ...rest }) {
  const id = useId(), [shown, setShown] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-base">{label}</label>
      <div className="relative">
        <input id={id} name={name} type={secret && !shown ? 'password' : secret ? 'text' : rest.type || 'text'} className={`${input} w-full`}
          style={secret ? { paddingRight: '4.5rem' } : undefined} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? `${id}-d` : undefined} {...rest} />
        {secret && <button type="button" aria-pressed={shown} aria-label={shown ? 'Hide password' : 'Show password'} onClick={() => setShown(!shown)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs underline">{shown ? 'Hide' : 'Show'}</button>}
      </div>
      {(error || hint) && <p id={`${id}-d`} role={error ? 'alert' : undefined} className={`mt-1 text-xs ${error ? 'text-danger' : 'text-slate-700'}`}>{error || hint}</p>}
    </div>
  )
}

export default function AuthScreen() {
  const [mode, setMode] = useState(location.pathname === '/reset-password' && token ? 'reset' : 'in')
  const [msg, setMsg] = useState(params.get('error') ? 'That link is invalid or has expired. Ask for a new one.' : '')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState(null) // set after sign-up (or sign-in while unverified): the check-your-inbox step. '' = address unknown
  const [social, setSocial] = useState([])
  useEffect(() => { fetch('/api/auth/providers').then((r) => r.json()).then(setSocial).catch(() => {}) }, [])
  const go = (m) => { setMode(m); setMsg(''); setErrors({}) }

  const submit = async (e) => {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.target))
    setMsg('')
    if (mode === 'up' || mode === 'reset') {
      const bad = mode === 'up' ? checkSignUp(f) : f.password.length < 10 ? { password: 'Use at least 10 characters.' } : f.password !== f.confirm ? { confirm: 'The two passwords do not match.' } : {}
      setErrors(bad)
      if (Object.keys(bad).length) return
    }
    setBusy(true)
    const id = (f.identifier || '').trim()
    const { data, error } = await (mode === 'in' ? (id.includes('@') ? authClient.signIn.email({ email: id, password: f.password, callbackURL: '/today' }) : authClient.signIn.username({ username: id, password: f.password }))
      : mode === 'up' ? authClient.signUp.email({ name: f.name.trim(), username: f.username, email: f.email.trim(), password: f.password, callbackURL: '/today' })
      : mode === 'forgot' ? authClient.requestPasswordReset({ email: f.email.trim(), redirectTo: '/reset-password' })
      : authClient.resetPassword({ newPassword: f.password, token }))
    setBusy(false)
    if (error?.code === 'EMAIL_NOT_VERIFIED') return setSentTo(id.includes('@') ? id : '') // sign-in already sent a fresh link
    if (error) {
      if (/USERNAME/.test(error.code || '')) return setErrors({ username: /TAKEN/.test(error.code) ? 'That username is taken. Try another.' : 'Use 3 to 30 letters, numbers, dots or underscores.' })
      return setMsg(error.status === 429 ? 'Too many tries. Wait a little and try again.' : error.status === 401 ? 'That email, username or password is not right.' : error.message || 'Something went wrong.')
    }
    if (mode === 'forgot') return setMsg('If that email has an account, a reset link is on its way. Check your inbox and spam.')
    if (mode === 'reset') { history.replaceState(null, '', '/today'); go('in'); return setMsg('Password changed. Sign in with the new one.') }
    if (mode === 'up' && !data?.token) setSentTo(f.email.trim()) // with no mail provider the session starts at once and this screen disappears
  }

  if (sentTo !== null) return <CheckInbox email={sentTo} back={() => { setSentTo(null); go('in') }} />
  return (
    <Shell kind={mode}>
      <form onSubmit={submit} noValidate className={`${panel} space-y-3`} aria-label={TITLE[mode]}>
        <h1 className="text-2xl">{TITLE[mode]}</h1>
        {mode === 'up' && <>
          <Field label="Your name" name="name" autoComplete="name" required error={errors.name} />
          <Field label="Username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required error={errors.username} hint="3 to 30 letters, numbers, dots or underscores." />
        </>}
        {mode === 'in' && <Field label="Email or username" name="identifier" autoComplete="username" autoCapitalize="none" spellCheck={false} required />}
        {(mode === 'up' || mode === 'forgot') && <Field label="Email" name="email" type="email" autoComplete="email" required error={errors.email} />}
        {mode !== 'forgot' && <Field label={mode === 'reset' ? 'New password' : 'Password'} name="password" secret required autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          error={errors.password} hint={mode === 'in' ? undefined : 'At least 10 characters.'} />}
        {(mode === 'up' || mode === 'reset') && <Field label="Confirm password" name="confirm" secret required autoComplete="new-password" error={errors.confirm} />}
        {mode === 'in' && <button type="button" className="text-xs underline" onClick={() => go('forgot')}>Forgot password?</button>}
        <button className={`${btn} ${BLUE} w-full`} disabled={busy}>{busy ? 'One moment…' : GO[mode]}</button>
        {msg && <p role="status" className="text-base">{msg}</p>}
      </form>
      {(mode === 'in' || mode === 'up') && social.length > 0 && (
        <div className="space-y-2">
          <p className="text-center text-xs text-slate-700">or continue with</p>
          <div className="flex gap-2">
            {social.map((p) => <button key={p} className={`${btn} ${ghost} flex-1`} onClick={() => authClient.signIn.social({ provider: p, callbackURL: '/today', errorCallbackURL: '/today?error=1' })}>{p === 'github' ? 'GitHub' : 'Google'}</button>)}
          </div>
        </div>
      )}
      <p className="text-base">
        {mode === 'in' ? <>New here? <button className="underline" onClick={() => go('up')}>Create an account</button></>
          : mode === 'up' ? <>Already have an account? <button className="underline" onClick={() => go('in')}>Sign in</button></>
          : <button className="underline" onClick={() => go('in')}>Back to sign in</button>}
      </p>
    </Shell>
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
    <Shell kind="sent">
      <section className={`${panel} space-y-3`} aria-label="Check your inbox">
        <h1 className="text-2xl">Check your inbox</h1>
        <p>{email ? <>We sent a confirmation link to <strong className="[overflow-wrap:anywhere]">{email}</strong>.</> : 'We sent a confirmation link to the email on your account.'}</p>
        <p>Open the email and tap <strong>Confirm my email</strong>. You will be signed in automatically.</p>
        <p className="text-xs text-slate-700">Nothing after a minute? Look in spam or promotions{email ? ', or send it again' : ''}.</p>
        {email && <button className={`${btn} ${BLUE} w-full`} onClick={resend} disabled={busy}>{busy ? 'One moment…' : 'Send the email again'}</button>}
        {msg && <p role="status" className="text-base">{msg}</p>}
      </section>
      <button className={`${btn} ${ghost}`} onClick={back}>Back to sign in</button>
    </Shell>
  )
}
