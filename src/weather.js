// Today's weather from Open-Meteo (no key), at the browser's location. Cached for an hour; a refusal is remembered for a day.
import { useEffect, useState } from 'react'

const KEY = 'desker.weather'
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } }

// WMO weather codes -> one of sun, cloud, rain, snow, storm
export const kindOf = (c) => c >= 95 ? 'storm' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : (c >= 51 && c <= 67) || (c >= 80 && c <= 82) ? 'rain' : c <= 1 ? 'sun' : 'cloud'

export const cachedWeather = () => { const w = read(); return w && w.kind && Date.now() - w.at < 36e5 ? w : null }

let pending
const load = () => pending ||= fetchWeather().finally(() => { pending = null })
async function fetchWeather() {
  const old = read()
  if (old?.deniedAt && Date.now() - old.deniedAt < 864e5) return null
  const pos = await new Promise((ok) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(ok, () => ok(null), { timeout: 8000, maximumAge: 36e5 }) : ok(null))
  if (!pos) { localStorage.setItem(KEY, JSON.stringify({ deniedAt: Date.now() })); return null }
  const { latitude: la, longitude: lo } = pos.coords
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la.toFixed(2)}&longitude=${lo.toFixed(2)}&daily=weather_code,temperature_2m_max&timezone=auto&forecast_days=1`)
  if (!r.ok) return null
  const d = (await r.json()).daily
  const w = { kind: kindOf(d.weather_code[0]), tmax: d.temperature_2m_max[0], at: Date.now() }
  localStorage.setItem(KEY, JSON.stringify(w))
  return w
}

export function useWeather() {
  const [w, setW] = useState(cachedWeather)
  useEffect(() => { if (!w) load().then((x) => x && setW(x)).catch(() => {}) }, [])   // eslint-disable-line react-hooks/exhaustive-deps
  return w
}
