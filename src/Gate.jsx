// Shows the app to signed-in users and the sign-in screen to everyone else. Also handles the password-reset link (/reset-password?token=...).
import { useEffect, useState } from 'react'
import App from './App.jsx'
import AuthScreen from './AuthScreen.jsx'
import { useSession } from './auth.js'
import { Avatar } from './px.jsx'

export default function Gate() {
  const { data, isPending } = useSession()
  const user = data?.user
  const [loaded, setLoaded] = useState(false) // "Loading" only before the first answer: later refetches (after sign-up, say) must not unmount the sign-in screen and lose its state
  useEffect(() => { if (!isPending) setLoaded(true) }, [isPending])
  useEffect(() => {
    const old = localStorage.uid // data saved in this browser before accounts existed: move it into the account, once
    if (user && old) fetch('/api/state', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claim: old }) }).then((r) => r.ok && localStorage.removeItem('uid')).catch(() => {})
  }, [user])
  if (!loaded) return <div className="flex items-center gap-3 p-6"><Avatar /><p role="status" className="text-slate-700">Loading…</p></div>
  return user ? <App /> : <AuthScreen />
}
