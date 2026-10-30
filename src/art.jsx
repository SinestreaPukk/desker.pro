import { Q } from './ui.js'
import { Icon } from './icons.jsx'
// Page banners reuse the one lakeside scene: a strip of its sky and mountains, slid sideways per page. Today gets the full scene (px.jsx).
export function Hero({ className = '' }) {
  return <div className={`px-strip ${className}`} aria-hidden="true"><img src="/pixel/scene-morning.png" alt="" className="px-art" /></div>
}

// Card cover strip: a mini 2x2 matrix with this task's box lit.
export function Cover({ q, className = '' }) {
  if (q === undefined) return null
  const cell = 'calc(4 * var(--px))'
  return <div className={`${className} flex items-center gap-3 bg-yuki-1 px-2`} style={{ height: 'calc(12 * var(--px))' }} aria-hidden="true">
    <div className="grid shrink-0" style={{ gridTemplateColumns: `repeat(2, ${cell})`, gridAutoRows: cell, gap: 'var(--px)' }}>
      {Q.map((x, i) => <span key={x.name} className={i === q ? x.lit : 'bg-yuki-2'} />)}
    </div>
  </div>
}

const BANNERS = {
  Goals: ['Goals', 'Build your pyramid. The AI links each task to a goal and uses its level to judge importance.'],
  Projects: ['Projects', 'Something bigger than a task: an investment, an exam, a launch. It owns the tasks that get it done.'],
  Calendar: ['Calendar', 'Planned tasks, deadlines and your calendar events in one place.'],
}

// Page head: title and sentence on the left, a strip of the scene on the right (above on small screens).
export function PageHead({ title, sub, icon, children }) {
  return (
    <header className="mb-8 flex flex-col gap-4 md:mb-10 lg:flex-row lg:gap-8">
      <Hero className="lg:order-2" />
      <div className="min-w-0 flex-1 lg:order-1">
        <div className="flex items-center gap-3">{icon}<h1 className="text-4xl md:text-5xl">{title}</h1></div>
        {sub && <p className="mt-2 max-w-2xl text-slate-700">{sub}</p>}
        {children}
      </div>
    </header>
  )
}

export function Banner({ tab }) {
  const b = BANNERS[tab]
  if (!b) return null
  return <PageHead title={b[0]} sub={b[1]} icon={<Icon name={tab} />} />
}
