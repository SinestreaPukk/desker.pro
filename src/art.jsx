import { Icon } from './icons.jsx'
// Each page has its own 192x24 stripe (art/authoring/gen_stripes.py). Today gets the full lake scene (px.jsx).
export function Hero({ name, className = '' }) {
  return <div className={`px-strip ${className}`} aria-hidden="true"><img src={`/pixel/strip-${name}.png`} alt="" width="192" height="24" className="px-art" /></div>
}

const STRIP = { Rhythm: 'calendar' } // no Rhythm stripe drawn yet: borrows the calendar one (listed in CHANGES.md)
const BANNERS = {
  Tasks: ['Tasks', 'A task is one thing to do. A deadline is an exam or assignment date that holds the tasks leading up to it.'],
  Goals: ['Goals', 'Build your pyramid. The AI links each task to a goal and uses its level to judge importance.'],
  Projects: ['Projects', 'A course or group project that lasts weeks. It holds several deadlines and their tasks, and shows how far along you are.'],
  Rhythm: ['Your rhythm', 'How long your work really takes and when you focus best. Desker learns it from your timers and energy taps, and plans around it.'],
  Calendar: ['Calendar', 'Planned tasks, deadlines and your calendar events in one place.'],
}

// Page head: title and sentence on the left, a strip of the scene on the right (above on small screens).
export function PageHead({ title, sub, icon, strip, children }) {
  return (
    <header className="mb-8 flex max-w-[1100px] flex-col gap-4 md:mb-10 lg:flex-row lg:gap-8">
      <Hero name={strip} className="lg:order-2" />
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
  return <PageHead title={b[0]} sub={b[1]} icon={<Icon name={tab} />} strip={STRIP[tab] || tab.toLowerCase()} />
}
