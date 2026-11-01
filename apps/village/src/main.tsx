import { lazy, Suspense, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { authClient, signIn } from './auth.ts'
import Picker from './Picker.tsx'
import Join from './Join.tsx'
import './index.css'

const World = lazy(() => import('./World.tsx')) // Phaser stays out of the picker's bundle

function App() {
  const { data, isPending } = authClient.useSession()
  const user = data?.user
  useEffect(() => { if (!isPending && !user) signIn() }, [isPending, user])
  if (!user) return <p className="pad">Signing you in…</p>
  const path = location.pathname.replace(/\/$/, '')
  const [, kind, slug] = path.match(/^\/(v|join)\/([\w-]+)$/) ?? []
  return (
    <>
      {!kind && <header className="bar"><b>Kodama Village</b><span>{user.name}</span></header>}
      {kind === 'join' ? <Join slug={slug} /> : slug ? <Suspense fallback={<p className="pad">Loading the world…</p>}><World slug={slug} /></Suspense> : <Picker />}
    </>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
