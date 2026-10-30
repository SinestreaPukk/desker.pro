import { useEffect, useRef } from 'react'

// Avatars: id -> 24x24 two-frame sheet (idle + blink). The coach is always the shimaenaga.
export const AVATARS = [
  ['person-a', 'Beanie, brown hair'], ['person-b', 'Beanie, black hair'], ['person-c', 'Beanie, rose hair'],
  ['shimaenaga', 'Shimaenaga'], ['usagi', 'Yuki-usagi'], ['kitsune', 'Kitsune'], ['nihonzaru', 'Nihonzaru'], ['tanuki', 'Tanuki'], ['shiba', 'Shiba'],
]
export const DEFAULT_AVATAR = 'person-a'
export const Avatar = ({ id = DEFAULT_AVATAR, scene, label = '', style }) => (
  <span role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : 'true'}
    className={`px-avatar ${scene ? 'px-avatar-scene' : ''}`} style={{ backgroundImage: `url(/pixel/av-${id}.sheet.png)`, ...style }} />
)

// Completion seal: three frames, one pass.
export const Hanko = () => <span className="px-hanko" aria-hidden="true" />

// Local time picks the palette of the same scene: morning, dusk or night.
export const sceneVariant = (d = new Date()) => { const h = d.getHours(); return h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 19 ? 'dusk' : 'night' }

// 1-art-pixel flakes, at most 40, whole-pixel steps at 8 fps. Paused while hidden, absent under reduced motion.
function Snow() {
  const ref = useRef(null)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const c = ref.current, g = c.getContext('2d')
    const flakes = Array.from({ length: 12 }, (_, i) => ({ x: (i * 53) % 192, y: (i * 31) % 62, v: 1 + (i % 3) === 2 ? 2 : 1, d: i % 2 ? 1 : -1 }))
    const draw = () => {
      g.clearRect(0, 0, 192, 80); g.fillStyle = '#F4F7F6'
      flakes.forEach((f) => { g.fillRect(f.x, f.y, 1, 1) })
    }
    let t = 0 // calm: a dozen flakes, each falls one art pixel every other tick
    const step = () => { t++; flakes.forEach((f, i) => { if (t % 2 === 0) f.y = (f.y + 1) % 64; if (i % 4 === 0 && t % 4 === 0) f.x = (f.x + f.d + 192) % 192 }) }
    draw()
    let id = setInterval(() => { step(); draw() }, 125)
    const vis = () => { clearInterval(id); if (!document.hidden) id = setInterval(() => { step(); draw() }, 125) }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis) }
  }, [])
  return <canvas ref={ref} width="192" height="80" className="px-flake" aria-hidden="true" />
}

// The banner: one lakeside scene at --px-scene, the user's avatar standing on the shore. Variant by local time.
export function Scene({ avatar }) {
  const v = sceneVariant()
  return (
    <div className="px-scene" role="img" aria-label={`A snowy lake at ${v === 'morning' ? 'morning' : v === 'dusk' ? 'dusk' : 'night'}`}>
      <img src={`/pixel/scene-${v}.png`} alt="" width="192" height="80" className="px-art" />
      <div style={{ position: 'absolute', left: 'calc(50% - 96 * var(--px-scene))', top: 'calc(-1 * var(--crop) * var(--px-scene))', width: 'calc(192 * var(--px-scene))', height: 'calc(80 * var(--px-scene))' }}>
        <Avatar id={avatar} scene style={{ position: 'absolute', left: 'calc(72 * var(--px-scene))', top: 'calc(50 * var(--px-scene))' }} />
        <Snow />
      </div>
    </div>
  )
}
