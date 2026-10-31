// Cozy pixel city for the sign-in screens (art/authoring/gen_city.py). Layers back to front: sky, drifting clouds, sky movers
// (balloon, blimp, birds), the city, windows that switch off and on, street movers (train, bus, boat), rain or snow.
// The stage is a whole multiple of the 160x200 art, so every pixel stays square; motion is in whole art pixels (CSS steps).
import scenes from './city-scenes.json'

const W = 160, H = 200
const url = (scene, layer) => `/pixel/city/${scene}-${layer}.png`
const Layer = ({ scene, layer, className = '' }) => <img src={url(scene, layer)} alt="" draggable="false" className={`wp-l ${className}`} />

function Mover({ scene, m, k }) {
  const run = W + m.w
  return (
    <div className="wp-mover" style={{ top: `${m.y / H * 100}%`, width: `${m.w / W * 100}%`, '--to': `${W / m.w * 100}%`, animationDuration: `${m.dur}s`, animationDelay: `${-m.dur * (k ? .6 : .35)}s`, animationTimingFunction: `steps(${run})` }}>
      <img src={url(scene, k ? 'mover2' : 'mover')} alt="" draggable="false" />
    </div>
  )
}

// scene: dusk | dawn | rain | snow | afternoon. Fills its positioned parent.
export default function Wallpaper({ scene, label }) {
  const m = scenes[scene]
  const movers = [m.mover, m.mover2].filter(Boolean).map((x, k) => ({ x, k }))
  return (
    <div className="wp" style={{ background: m.bg }} role="img" aria-label={label}>
      <div className="wp-stage">
        <Layer scene={scene} layer="sky" />
        <img src={url(scene, 'clouds')} alt="" draggable="false" className="wp-clouds" />
        {movers.filter(({ x }) => x.layer === 'sky').map(({ x, k }) => <Mover key={k} scene={scene} m={x} k={k} />)}
        <Layer scene={scene} layer="city" />
        <Layer scene={scene} layer="lightA" className="wp-blink wp-a" />
        <Layer scene={scene} layer="lightB" className="wp-blink wp-b" />
        {movers.filter(({ x }) => x.layer === 'front').map(({ x, k }) => <Mover key={k} scene={scene} m={x} k={k} />)}
        {m.fall && [1, 2].map((n) => <div key={n} className={`wp-fall wp-${m.fall} wp-f${n}`} style={{ backgroundImage: `url(${url(scene, `fall${n}`)})` }} />)}
      </div>
    </div>
  )
}
