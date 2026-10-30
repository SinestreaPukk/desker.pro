import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/vt323'
import './index.css'
import App from './App.jsx'

const Dsb = lazy(() => import('./Dsb.jsx')) // owner dashboard: kept out of the main bundle
const dsb = location.pathname === '/dsb'

createRoot(document.getElementById('root')).render(dsb ? <Suspense fallback={null}><Dsb /></Suspense> : <App />)
