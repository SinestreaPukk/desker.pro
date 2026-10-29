import { Icon } from './icons.jsx'
// Flat geometric artwork in the app's calm palette. No photos or network: everything is inline SVG.
const P = ['#b4caf0', '#7fa3e0', '#35599a', '#e6edfa', '#f2b8aa', '#f3d98e', '#b9e3d3', '#cfc4f0']
const pick = (v, ...i) => i.map((n) => P[(n + v) % P.length])

// Wide banner art: stacked pills, rings and a check, like a sticker sheet. v (0-3) shifts the palette.
export function Hero({ v = 0, className = '' }) {
  const [a, b, c, d, e, f] = pick(v, 0, 1, 2, 4, 5, 6)
  return (
    <svg viewBox="0 0 360 150" preserveAspectRatio="xMaxYMid meet" className={className} aria-hidden="true">
      <rect x="-20" y="14" width="250" height="40" rx="20" fill={a} />
      <rect x="120" y="60" width="260" height="40" rx="20" fill={e} />
      <rect x="-10" y="106" width="200" height="40" rx="20" fill={f} />
      <circle cx="262" cy="34" r="26" fill={b} />
      <circle cx="262" cy="34" r="15" fill="none" stroke="#fff" strokeWidth="3" />
      <circle cx="262" cy="34" r="6" fill="#fff" />
      <circle cx="78" cy="80" r="22" fill={c} />
      <path d="M68 80l7 7 12-14" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="205" y="104" width="86" height="34" rx="17" fill="#fff" />
      <path d="M228 121h40" stroke={c} strokeWidth="4" strokeLinecap="round" />
      <circle cx="318" cy="122" r="18" fill={d === '#e6edfa' ? a : d} />
      <path d="M318 113v18M309 122h18" stroke="#fff" strokeWidth="3.500" strokeLinecap="round" />
    </svg>
  )
}

// Card cover strip. The same task id always gets the same cover.
export function Cover({ seed = 0, className = '' }) {
  const v = Math.abs(seed) % 4
  const [a, b, c] = pick(v * 2, 0, 4, 5)
  const x = (Math.abs(seed) * 37) % 60
  return (
    <svg viewBox="0 0 240 52" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <rect width="240" height="52" fill={a} />
      {v === 0 && <><circle cx={150 + x} cy="26" r="34" fill={b} /><circle cx={60 + x / 2} cy="40" r="22" fill={c} /></>}
      {v === 1 && <><rect x={20 + x} y="-6" width="90" height="64" rx="32" fill={b} /><rect x={150} y="14" width="70" height="38" rx="19" fill={c} /></>}
      {v === 2 && <><path d={`M0 52L${70 + x} 0L${130 + x} 52Z`} fill={b} /><circle cx="200" cy="18" r="16" fill={c} /></>}
      {v === 3 && <><rect x="0" y="30" width="240" height="22" fill={b} /><circle cx={40 + x * 2} cy="24" r="18" fill={c} /><circle cx="210" cy="14" r="8" fill="#fff" /></>}
    </svg>
  )
}

const BANNERS = {
  Tasks: ['Your board', 'Drag a card between boxes, or let the AI place everything.'],
  Goals: ['Goals', 'Build your pyramid. The AI links each task to a goal and uses its level to judge importance.'],
  Projects: ['Projects', 'Something bigger than a task: an investment, an exam, a launch. It owns the tasks that get it done.'],
  Deadlines: ['Deadlines', 'An exam, a project, a trip. The AI works out the hours and suggests tasks.'],
  Calendar: ['Calendar', 'Planned tasks, deadlines and your calendar events in one place.'],
}

// Notion-style page head: wide cover, an icon that overlaps its edge, then the title.
export function PageHead({ title, sub, v = 0, icon, children }) {
  return (
    <header className="mb-8 md:mb-10">
      <div className="overflow-hidden rounded-3xl bg-[#eef3fc]"><Hero v={v} className="h-32 w-full md:h-40" /></div>
      <div className="relative -mt-8 px-2 md:px-5">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-white text-accent-dark">{icon}</span>
        <h1 className="greeting mt-3 text-4xl md:text-5xl">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-slate-700">{sub}</p>}
        {children}
      </div>
    </header>
  )
}

export function Banner({ tab }) {
  const b = BANNERS[tab]
  if (!b) return null
  return <PageHead title={b[0]} sub={b[1]} v={Object.keys(BANNERS).indexOf(tab) + 1} icon={<span className="scale-150"><Icon name={tab} /></span>} />
}
