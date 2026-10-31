import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/vt323'
import './index.css'
import Gate from './Gate.jsx'

// Sharp pixels on any screen: an art pixel must cover a whole number of device pixels, or some come out wider than others.
// On a 1.5x display or a zoomed page, 2 css px is 3 device px (fine) but 1 css px is 1.5 (uneven). Snap each unit to the nearest whole device pixel count.
const snap = (css) => Math.max(1, Math.round(css * devicePixelRatio)) / devicePixelRatio
function sharp() {
  const r = document.documentElement.style, wide = innerWidth >= 640
  r.setProperty('--px', `${snap(2)}px`); r.setProperty('--px-scene', `${snap(wide ? 4 : 2)}px`)
}
sharp(); addEventListener('resize', sharp)

const Dsb = lazy(() => import('./Dsb.jsx')) // owner dashboard: kept out of the main bundle
const dsb = location.pathname === '/dsb'

createRoot(document.getElementById('root')).render(dsb ? <Suspense fallback={null}><Dsb /></Suspense> : <Gate />)
