import { Icon } from './icons.jsx'
import { sceneUrl } from './px.jsx'
// Page banners reuse the one lakeside scene: a strip of its sky and mountains, slid sideways per page. Today gets the full scene (px.jsx).
export function Hero({ className = '' }) {
  return <div className={`px-strip ${className}`} aria-hidden="true"><img src={sceneUrl('morning')} alt="" className="px-art" /></div>
}

// One pattern per quadrant (art/authoring/gen_covers.py): torii, peaks, pines, night drifts.
export function Cover({ q = 3, className = '' }) {
  return <div className={`${className} px-art`} aria-hidden="true" style={{ height: 'calc(16 * var(--px))', backgroundImage: `url(/pixel/cover-q${q}.png)`, backgroundRepeat: 'repeat-x', backgroundSize: 'calc(48 * var(--px)) 100%' }} />
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
