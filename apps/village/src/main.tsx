import { lazy, Suspense, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { authClient, signIn } from './auth.ts'
import Picker from './Picker.tsx'
import Join from './Join.tsx'
import New from './New.tsx'
import { mine } from './api.ts'
import '@fontsource/vt323'
import './index.css'

// Phones: no pinch-zoom or double-tap zoom (iOS Safari ignores user-scalable=no)
for (const t of ['gesturestart', 'gesturechange']) document.addEventListener(t, (e) => e.preventDefault())

const World = lazy(() => import('./World.tsx')) // Phaser stays out of the picker's bundle

/** desker.dev's "Study in the village" button: straight into the village you visited last (the list is newest-visit first), else the picker. */
function Go() {
  useEffect(() => { mine().then((r) => location.replace(r.villages[0] ? `/v/${r.villages[0].slug}` : '/'), () => location.replace('/')) }, [])
  return <p className="pad">Opening your village…</p>
}

function App() {
  const { data, isPending } = authClient.useSession()
  const user = data?.user
  useEffect(() => { if (!isPending && !user) signIn() }, [isPending, user])
  if (!user) return <p className="pad">Signing you in…</p>
  const path = location.pathname.replace(/\/$/, '')
  const [, kind, slug] = path.match(/^\/(v|join)\/([\w-]+)$/) ?? []
  if (path === '/go') return <Go />
  if (path === '/new') return <New />
  return (
    <>
      {!kind && <header className="bar"><b>Kodama Village</b><span>{user.name}</span></header>}
      {kind === 'join' ? <Join slug={slug} /> : slug ? <Suspense fallback={<p className="pad">Loading the world…</p>}><World slug={slug} /></Suspense> : <Picker />}
    </>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
