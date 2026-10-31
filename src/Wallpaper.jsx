// Cosy pixel city seen from a tall tower, for the sign-in screens (art/authoring/gen_city.py draws it).
// The generator lists the layers back to front in src/city-scenes.json; this component only knows how each kind moves:
//   img (still) / drift (a 2x-wide image sliding one screen, looping) / cross (a sprite travelling across) / strip (a traffic lane, loops)
//   frames (3 images shown in turn: smoke, steam) / blink (windows and lights going off and on) / fall (rain or snow, loops).
// The stage is a whole multiple of the 160x200 art so every pixel stays square; motion happens in whole art pixels (CSS steps).
import scenes from './city-scenes.json'

const W = 160, H = 200
const url = (scene, n) => `/pixel/city/${scene}-${n}.png`
const Img = ({ scene, n, className = '', style }) => <img src={url(scene, n)} alt="" draggable="false" className={`wp-l ${className}`} style={style} />

function Layer({ scene, l }) {
  switch (l.k) {
    case 'img': return <Img scene={scene} n={l.n} />
    case 'drift': return <img src={url(scene, l.n)} alt="" draggable="false" className="wp-wide" style={{ animationDuration: `${l.dur}s`, animationTimingFunction: 'steps(160)' }} />
    case 'strip': return <img src={url(scene, l.n)} alt="" draggable="false" className="wp-wide" style={{ animationDuration: `${l.dur}s`, animationDirection: l.rev ? 'reverse' : 'normal', animationTimingFunction: 'steps(160)' }} />
    case 'blink': return <Img scene={scene} n={l.n} className={`wp-blink ${l.cls}`} />
    case 'fall': return <div className={`wp-fall wp-${l.kind} ${l.cls}`} style={{ backgroundImage: `url(${url(scene, l.n)})` }} />
    case 'frames': return Array.from({ length: l.count }, (_, i) => <Img key={i} scene={scene} n={`${l.n}${i}`} className="wp-frame" style={{ animationDuration: `${l.dur}s`, animationDelay: `${-i * l.dur / l.count}s` }} />)
    case 'cross': return (
      <div className="wp-mover" style={{ top: `${l.y / H * 100}%`, width: `${l.w / W * 100}%`, '--to': `${W / l.w * 100}%`, animationDuration: `${l.dur}s`, animationDelay: `${-l.dur * l.off}s`, animationTimingFunction: `steps(${W + l.w})` }}>
        <img src={url(scene, l.n)} alt="" draggable="false" />
      </div>
    )
    default: return null
  }
}

// scene: dusk | dawn | rain | snow | afternoon. Fills its positioned parent.
export default function Wallpaper({ scene, label }) {
  const m = scenes[scene]
  return (
    <div className="wp" style={{ background: m.bg }} role="img" aria-label={label}>
      <div className="wp-stage">{m.layers.map((l) => <Layer key={l.n} scene={scene} l={l} />)}</div>
    </div>
  )
}
