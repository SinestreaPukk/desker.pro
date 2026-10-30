import { useEffect, useRef } from 'react'
import motion from './scene-motion.json'

// The one avatar (24x24, idle + blink). It is the logo, the user in the scene, and the coach's face.
// In the banner it is the branchless scene pose (av-scene), perched on the post; everywhere else the UI sprite.
export const Avatar = ({ scene, label = '', style }) => (
  <span role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : 'true'}
    className={`px-avatar ${scene ? 'px-avatar-scene' : ''}`} style={{ backgroundImage: `url(/pixel/${scene ? 'av-scene' : 'av-main'}.sheet.png)`, ...style }} />
)

// Completion seal: three frames, one pass.
export const Hanko = () => <span className="px-hanko" aria-hidden="true" />

// Local time picks the palette of the same scene: morning, dusk or night.
export const sceneVariant = (d = new Date()) => { const h = d.getHours(); return h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 19 ? 'dusk' : 'night' }

// Calm motion on a 192x80 canvas, whole art-pixel steps at 8 fps. Two layers so snow falls behind and in front of the avatar:
// slow dim flakes behind, a few quicker bright ones in front. The back layer also slides three dashes on the moon's path at 2 fps.
// Paused while hidden, absent under reduced motion.
function Motion({ variant, front }) {
  const ref = useRef(null)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const col = motion[variant], g = ref.current.getContext('2d')
    const flakes = Array.from({ length: front ? 4 : 7 }, (_, i) => ({ x: (front ? 31 : 17) + i * (front ? 47 : 27), y: (i * (front ? 23 : 13)) % 66 }))
    let t = 0
    const draw = () => {
      g.clearRect(0, 0, 192, 80)
      g.fillStyle = front ? col.front : col.back
      flakes.forEach((f) => g.fillRect(f.x, f.y, 1, 1))
      if (!front) { g.fillStyle = col.glint; motion.shimmer.forEach(([x, y, w]) => g.fillRect(x + ((t >> 2) & 1), y, w - ((t >> 2) & 1), 1)) }
    }
    const step = () => {
      t++
      flakes.forEach((f) => { if (t % (front ? 2 : 4) === 0) { f.y = (f.y + 1) % 66; if (t % (front ? 16 : 24) === 0) f.x = (f.x + 1) % 192 } })
      draw()
    }
    draw()
    let id = setInterval(step, 125)
    const vis = () => { clearInterval(id); if (!document.hidden) id = setInterval(step, 125) }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis) }
  }, [variant, front])
  return <canvas ref={ref} width="192" height="80" className="px-flake" aria-hidden="true" />
}

// The banner: one lakeside scene at --px-scene, the shimaenaga perched on a dock post. Variant by local time.
export function Scene() {
  const v = sceneVariant()
  return (
    <div className="px-scene" role="img" aria-label={`A snowy lake at ${v === 'morning' ? 'morning' : v === 'dusk' ? 'dusk' : 'night'}`}>
      <img src={`/pixel/scene-${v}.png`} alt="" width="192" height="80" className="px-art" />
      <div style={{ position: 'absolute', left: 'calc(50% - 96 * var(--px-scene))', top: 'calc(-1 * var(--crop) * var(--px-scene))', width: 'calc(192 * var(--px-scene))', height: 'calc(80 * var(--px-scene))' }}>
        <Motion variant={v} />
        <Avatar scene style={{ position: 'absolute', left: 'calc(114 * var(--px-scene))', top: 'calc(43 * var(--px-scene))' }} />
        <Motion variant={v} front />
      </div>
    </div>
  )
}
