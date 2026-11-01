// M: a small overview of the village. Dots for everyone here (you ringed), click to walk there.
import { useEffect, useRef, useState } from 'react'
import { OUTFIT_TINTS, parseMap, type Colour, type World } from '@desker/shared'

const PX = 4 // pixels per tile
const ZONE: Record<string, string> = { plaza: '#e7eef8', library: '#f1e4cf', tables: '#e3ecdc', lounge: '#f3dfdf', garden: '#dcebe3' }
const hex = (c: string) => '#' + (OUTFIT_TINTS[c as Colour] ?? 0xf2f5fa).toString(16).padStart(6, '0')

export default function Minimap({ positions, colours, me, onGo }: { positions: () => { userId: string; x: number; y: number }[]; colours: Record<string, string>; me: string; onGo: (x: number, y: number) => void }) {
  const [world, setWorld] = useState<World | null>(null), cv = useRef<HTMLCanvasElement>(null)
  useEffect(() => { fetch('/maps/snowy_campus.json').then((r) => r.json()).then((j) => setWorld(parseMap(j))).catch(() => {}) }, [])
  useEffect(() => {
    if (!world || !cv.current) return
    const g = cv.current.getContext('2d')!
    const draw = () => {
      g.clearRect(0, 0, world.w * PX, world.h * PX)
      for (const z of world.zones) { g.fillStyle = ZONE[z.id] ?? '#e7eef8'; g.fillRect(z.x * PX, z.y * PX, z.w * PX, z.h * PX) }
      g.fillStyle = '#7d92b3'
      for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) if (world.blocked[y * world.w + x]) g.fillRect(x * PX, y * PX, PX, PX)
      for (const p of positions()) {
        const x = (p.x + 0.5) * PX, y = (p.y + 0.5) * PX
        g.beginPath(); g.arc(x, y, p.userId === me ? 3 : 2.4, 0, 7); g.fillStyle = hex(colours[p.userId] ?? 'snow'); g.fill(); g.lineWidth = 1; g.strokeStyle = '#14213d'; g.stroke()
        if (p.userId === me) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.strokeStyle = '#d89b3a'; g.lineWidth = 1.5; g.stroke() }
      }
    }
    draw(); const t = setInterval(draw, 400); return () => clearInterval(t)
  }, [world, positions, colours, me])
  if (!world) return null
  return <canvas ref={cv} className="minimap" width={world.w * PX} height={world.h * PX} aria-label="Minimap: click to walk there" role="img"
    onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onGo(Math.floor(((e.clientX - r.left) / r.width) * world.w), Math.floor(((e.clientY - r.top) / r.height) * world.h)) }} />
}
