import { useEffect, useRef } from 'react'
import motion from './scene-motion.json'

// The one avatar (24x24, idle + blink). It is the logo, the user in the scene, and the coach's face.
export const Avatar = ({ scene, label = '', style }) => (
  <span role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : 'true'}
    className={`px-avatar ${scene ? 'px-avatar-scene' : ''}`} style={{ backgroundImage: 'url(/pixel/av-main.sheet.png)', ...style }} />
)

// Completion seal: three frames, one pass.
export const Hanko = () => <span className="px-hanko" aria-hidden="true" />

// Local time picks the palette of the same scene: morning, dusk or night.
export const sceneVariant = (d = new Date()) => { const h = d.getHours(); return h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 19 ? 'dusk' : 'night' }

// Calm motion on a 192x80 canvas, whole art-pixel steps at 8 fps: two clouds drifting a pixel a second, a few sparkles
// on the lake that come and go, and half a dozen flakes. Paused while hidden, absent under reduced motion.
const CLOUDS = [
  { x: 24, y: 5, rows: ['.......ccc..........', '....ccccccccc..cc...', '..cccccccccccccccccc', 'sssssssssssssssssss.'] },
  { x: 120, y: 13, rows: ['....cccc......', '.ccccccccc.cc.', 'cccccccccccccc', 'sssssssssssss.'] },
]
const SPARKS = [[58, 52], [72, 58], [84, 51], [97, 61], [112, 55], [127, 60], [139, 52], [150, 58], [66, 62], [104, 50]]
function Motion({ variant }) {
  const ref = useRef(null)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const col = motion[variant], g = ref.current.getContext('2d')
    const clouds = CLOUDS.map((c) => ({ ...c, w: c.rows[0].length }))
    const flakes = Array.from({ length: 6 }, (_, i) => ({ x: 20 + i * 30, y: (i * 11) % 60 }))
    let t = 0
    const draw = () => {
      g.clearRect(0, 0, 192, 80)
      clouds.forEach((c) => c.rows.forEach((r, j) => [...r].forEach((ch, i) => {
        if (ch === '.') return
        g.fillStyle = ch === 'c' ? col.cloud : col.shade
        g.fillRect(c.x + i, c.y + j, 1, 1)
      })))
      g.fillStyle = col.spark
      SPARKS.forEach(([x, y], i) => { if (((t >> 3) + i) % 3 === 0) g.fillRect(x, y, 1, 1) })
      flakes.forEach((f) => g.fillRect(f.x, f.y, 1, 1))
    }
    const step = () => {
      t++
      if (t % 8 === 0) clouds.forEach((c) => { c.x = c.x > 192 ? -c.w : c.x + 1 })
      if (t % 2 === 0) flakes.forEach((f) => { f.y = (f.y + 1) % 64 })
      draw()
    }
    draw()
    let id = setInterval(step, 125)
    const vis = () => { clearInterval(id); if (!document.hidden) id = setInterval(step, 125) }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis) }
  }, [variant])
  return <canvas ref={ref} width="192" height="80" className="px-flake" aria-hidden="true" />
}

// The banner: one lakeside scene at --px-scene, the user's avatar standing on the shore. Variant by local time.
export function Scene() {
  const v = sceneVariant()
  return (
    <div className="px-scene" role="img" aria-label={`A snowy lake at ${v === 'morning' ? 'morning' : v === 'dusk' ? 'dusk' : 'night'}`}>
      <img src={`/pixel/scene-${v}.png`} alt="" width="192" height="80" className="px-art" />
      <div style={{ position: 'absolute', left: 'calc(50% - 96 * var(--px-scene))', top: 'calc(-1 * var(--crop) * var(--px-scene))', width: 'calc(192 * var(--px-scene))', height: 'calc(80 * var(--px-scene))' }}>
        <Avatar scene style={{ position: 'absolute', left: 'calc(72 * var(--px-scene))', top: 'calc(50 * var(--px-scene))' }} />
        <Motion variant={v} />
      </div>
    </div>
  )
}
