import { useEffect, useRef, useState } from 'react'
import motion from './scene-motion.json'
import { cachedWeather, useWeather } from './weather.js'

// The one avatar (24x24, idle + blink). It is the logo, the user in the scene, and the coach's face.
// In the banner it is the branchless scene pose (av-scene), perched on the post; everywhere else the UI sprite.
export const Avatar = ({ scene, label = '', style }) => (
  <span role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : 'true'}
    className={`px-avatar ${scene ? 'px-avatar-scene' : ''}`} style={{ backgroundImage: `url(/pixel/${scene ? 'av-scene' : 'av-main'}.sheet.png)`, ...style }} />
)

// The kodama: a tree spirit that follows the goals' milestones (see milestones.js).
export const Kodama = ({ mood = 'idle' }) => <span className="px-kodama" data-mood={mood} aria-hidden="true" />

// Completion seal: three frames, one pass.
export const Hanko = () => <span className="px-hanko" aria-hidden="true" />

// The scene follows the day's weather: rain is rainy, snow or a cold day is winter, anything else summer (`?season=` overrides it).
// Without a location the month decides (December to February is winter). Local time picks morning, dusk or night.
export const SEASONS = ['winter', 'summer', 'rainy']
export const sceneSeason = (d = new Date()) => {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('season') : null
  if (SEASONS.includes(q)) return q
  const w = cachedWeather()
  if (w) return w.kind === 'rain' || w.kind === 'storm' ? 'rainy' : w.kind === 'snow' || w.tmax <= 4 ? 'winter' : 'summer'
  const m = d.getMonth()
  return m === 11 || m < 2 ? 'winter' : 'summer'
}
export const sceneUrl = (variant, season = sceneSeason()) => `/pixel/scene-${season}-${variant}.png`

export const sceneVariant = (d = new Date()) => { const h = d.getHours(); return h >= 6 && h < 16 ? 'morning' : h >= 16 && h < 19 ? 'dusk' : 'night' }

// Calm motion on a 192x80 canvas, whole art-pixel steps at 8 fps. Two layers so snow falls behind and in front of the avatar:
// slow dim flakes behind, a few quicker bright ones in front. The back layer also slides three dashes on the moon's path at 2 fps.
// Paused while hidden, absent under reduced motion.
function Motion({ variant, season, front }) {
  const ref = useRef(null)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const col = motion[season][variant], fall = motion[season].fall, g = ref.current.getContext('2d')
    const rain = fall === 'rain'
    const flakes = fall === 'none' ? [] : Array.from({ length: rain ? (front ? 8 : 14) : front ? 4 : 7 }, (_, i) => ({ x: (front ? 31 : 17) + i * (front ? 47 : 27), y: (i * (front ? 23 : 13)) % 66 }))
    let t = 0
    const draw = () => {
      g.clearRect(0, 0, 192, 80)
      g.fillStyle = front ? col.front : col.back
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
  }, [variant, season, front])
  return <canvas ref={ref} width="192" height="80" className="px-flake" aria-hidden="true" />
}

// The banner: one lakeside scene at --px-scene, the shimaenaga perched on a dock post. Variant by local time.
export function Scene() {
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 6e4); return () => clearInterval(id) }, [])   // the clock moves the light
  useWeather()
  const v = sceneVariant(), season = sceneSeason()
  return (
    <div className="px-scene" role="img" aria-label={`A lake in ${season === 'rainy' ? 'the rain' : season}, ${v === 'morning' ? 'morning' : v === 'dusk' ? 'dusk' : 'night'}`}>
      <img src={sceneUrl(v, season)} alt="" width="192" height="80" className="px-art" />
      <div style={{ position: 'absolute', left: 'calc(50% - 96 * var(--px-scene))', top: 'calc(-1 * var(--crop) * var(--px-scene))', width: 'calc(192 * var(--px-scene))', height: 'calc(80 * var(--px-scene))' }}>
        <Motion variant={v} season={season} />
        <Avatar scene style={{ position: 'absolute', left: 'calc(114 * var(--px-scene))', top: 'calc(43 * var(--px-scene))' }} />
        <Motion variant={v} season={season} front />
      </div>
    </div>
  )
}
