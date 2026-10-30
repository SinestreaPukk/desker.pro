import { Icon } from './icons.jsx'
// Page banners reuse the one lakeside scene: a strip of its sky and mountains, slid sideways per page. Today gets the full scene (px.jsx).
const SHIFT = [0, 48, 96, 144] // art px, whole numbers

export function Hero({ v = 0, className = '' }) {
  return <div className={`px-strip ${className}`} aria-hidden="true"><img src="/pixel/scene-morning.png" alt="" className="px-art" style={{ left: `calc(${-SHIFT[v % 4]} * var(--px-scene))` }} /></div>
}

// Card cover strip. The same task id always gets the same slice of the scene.
export function Cover({ seed = 0, className = '' }) {
  return <div className={`${className} overflow-hidden`} style={{ position: 'relative', height: 'calc(16 * var(--px))', background: 'var(--color-kori-1)' }} aria-hidden="true">
    <img src="/pixel/scene-morning.png" alt="" className="px-art" style={{ position: 'absolute', top: 'calc(-28 * var(--px))', left: `calc(${-(Math.abs(seed) * 37) % 130} * var(--px))`, width: 'calc(192 * var(--px))', maxWidth: 'none' }} />
  </div>
}

const BANNERS = {
  Goals: ['Goals', 'Build your pyramid. The AI links each task to a goal and uses its level to judge importance.'],
  Projects: ['Projects', 'Something bigger than a task: an investment, an exam, a launch. It owns the tasks that get it done.'],
  Calendar: ['Calendar', 'Planned tasks, deadlines and your calendar events in one place.'],
}

// Page head: scene strip, then the title with its pixel icon.
export function PageHead({ title, sub, v = 0, icon, children }) {
  return (
    <header className="mb-8 md:mb-10">
      <div className="border-b border-ink"><Hero v={v} /></div>
      <div className="mt-4 flex items-center gap-3">{icon}<h1 className="text-4xl md:text-5xl">{title}</h1></div>
      {sub && <p className="mt-2 max-w-2xl text-slate-700">{sub}</p>}
      {children}
    </header>
  )
}

export function Banner({ tab }) {
  const b = BANNERS[tab]
  if (!b) return null
  return <PageHead title={b[0]} sub={b[1]} v={Object.keys(BANNERS).indexOf(tab) + 1} icon={<Icon name={tab} />} />
}
