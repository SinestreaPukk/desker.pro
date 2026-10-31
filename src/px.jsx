import { useEffect, useRef, useState } from 'react'
import motion from './scene-motion.json'
import { cachedWeather, useWeather } from './weather.js'

// The one avatar (24x24, idle + blink): the logo and the coach's face. The banner scene has no avatar.
export const Avatar = ({ label = '', style }) => (
  <span role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : 'true'}
    className="px-avatar" style={{ backgroundImage: 'url(/pixel/av-main.sheet.png)', ...style }} />
)

// The kodama: a tree spirit that follows the goals' milestones (see milestones.js).
export const Kodama = ({ mood = 'idle' }) => <span className="px-kodama" data-mood={mood} aria-hidden="true" />

// Completion seal: three frames, one pass.
export const Hanko = () => <span className="px-hanko" aria-hidden="true" />

// The scene follows the calendar: December to February is winter, March to May spring, June to August summer, September to November autumn
// (`?season=` overrides it). A snowy day is always winter. Rain is weather, not a season: it falls over whichever season it is.
// Local time picks morning, dusk or night.
export const SEASONS = ['winter', 'spring', 'summer', 'autumn']
export const sceneSeason = (d = new Date()) => {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('season') : null
  if (SEASONS.includes(q)) return q
  if (cachedWeather()?.kind === 'snow') return 'winter'
  const m = d.getMonth()
  return m === 11 || m < 2 ? 'winter' : m < 5 ? 'spring' : m < 8 ? 'summer' : 'autumn'
}
export const sceneRain = () => ['rain', 'storm'].includes(cachedWeather()?.kind)
export const sceneUrl = (variant, season = sceneSeason()) => `/pixel/scene-${season}-${variant}.png`

export const sceneVariant = (d = new Date()) => { const h = d.getHours(); return h >= 6 && h < 16 ? 'morning' : h >= 16 && h < 19 ? 'dusk' : 'night' }

// Calm motion on a 192x80 canvas, whole art-pixel steps at 8 fps. Two layers so snow falls behind and in front of the avatar:
// slow dim flakes behind, a few quicker bright ones in front. The back layer also slides three dashes on the moon's path at 2 fps.
// Paused while hidden, absent under reduced motion.
function Motion({ variant, season, front, rainy }) {
  const ref = useRef(null)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const col = motion[season][variant], fall = rainy ? 'rain' : motion[season].fall, g = ref.current.getContext('2d')
    const rain = fall === 'rain'
    const flakes = fall === 'none' ? [] : Array.from({ length: rain ? (front ? 8 : 14) : front ? 4 : 7 }, (_, i) => ({ x: (front ? 31 : 17) + i * (front ? 47 : 27), y: (i * (front ? 23 : 13)) % 66 }))
    let t = 0
    const draw = () => {
      g.clearRect(0, 0, 192, 80)
      g.fillStyle = rain ? (front ? col.rainFront : col.rainBack) : front ? col.front : col.back
      flakes.forEach((f) => g.fillRect(f.x, f.y, 1, rain ? 2 : 1))
      if (!front) { g.fillStyle = col.glint; motion.shimmer.forEach(([x, y, w]) => g.fillRect(x + ((t >> 2) & 1), y, w - ((t >> 2) & 1), 1)) }
    }
    const step = () => {
      t++
      flakes.forEach((f) => { if (rain) { f.y = (f.y + (front ? 3 : 2)) % 66; if (t % 3 === 0) f.x = (f.x + 1) % 192 } else if (t % (front ? 2 : 4) === 0) { f.y = (f.y + 1) % 66; if (t % (fall === 'snow' ? (front ? 16 : 24) : (front ? 6 : 8)) === 0) f.x = (f.x + 1) % 192 } })
      draw()
    }
    draw()
    let id = setInterval(step, 125)
    const vis = () => { clearInterval(id); if (!document.hidden) id = setInterval(step, 125) }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis) }
  }, [variant, season, front, rainy])
  return <canvas ref={ref} width="192" height="80" className="px-flake" aria-hidden="true" />
}

// The banner: one mountain-and-lake scene at --px-scene. Variant by local time.
export function Scene({ variant, season: pickedSeason }) {
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 6e4); return () => clearInterval(id) }, [])   // the clock moves the light
  useWeather()
  const v = variant || sceneVariant(), season = pickedSeason || sceneSeason(), rainy = !pickedSeason && sceneRain()
  return (
    <div className="px-scene" role="img" aria-label={`A calm mountain lake in ${season}${rainy ? ' rain' : ''}, ${v === 'morning' ? 'morning' : v === 'dusk' ? 'dusk' : 'night'}`}>
      <img src={sceneUrl(v, season)} alt="" width="192" height="80" className="px-art" />
      <div style={{ position: 'absolute', left: 'calc(50% - 96 * var(--px-scene))', top: 'calc(-1 * var(--crop) * var(--px-scene))', width: 'calc(192 * var(--px-scene))', height: 'calc(80 * var(--px-scene))' }}>
        <Motion variant={v} season={season} rainy={rainy} />
        <Motion variant={v} season={season} rainy={rainy} front />
      </div>
    </div>
  )
}
