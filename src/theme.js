// Light, dark, or follow the device. Stored on this device only (a laptop at night and a phone by day can differ), not in the account.
import { useSyncExternalStore } from 'react'

const KEY = 'theme' // 'light' | 'dark' | absent = follow the device
const dark = () => matchMedia('(prefers-color-scheme: dark)')
export const preference = () => { try { return localStorage[KEY] || 'auto' } catch { return 'auto' } }
export const resolved = () => { const p = preference(); return p === 'auto' ? (dark().matches ? 'dark' : 'light') : p }

const listeners = new Set()
const apply = () => { document.documentElement.dataset.theme = resolved(); listeners.forEach((f) => f()) }
export function setPreference(p) {
  try { if (p === 'auto') localStorage.removeItem(KEY); else localStorage[KEY] = p } catch { /* storage blocked: applies for this visit only */ }
  apply()
}
export function initTheme() { apply(); dark().addEventListener('change', apply) }
export const useTheme = () => useSyncExternalStore((f) => { listeners.add(f); return () => listeners.delete(f) }, resolved)
