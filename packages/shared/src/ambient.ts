// Day/night tint from the viewer's local time (SPEC §4.3): dawn 05:30-07:00, day, dusk 17:30-19:00, night with lamps on. Pure, so it is tested.
export interface Ambient { tint: number; strength: number; lamps: boolean } // tint: 0xRRGGBB multiplied over the world; strength 0..1 (0 = daylight)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const mix = (a: number, b: number, t: number) => ((Math.round(lerp(a >> 16, b >> 16, t)) << 16) | (Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t)) << 8) | Math.round(lerp(a & 255, b & 255, t)))
const NIGHT = 0x5a6a9a, DAWN = 0xf2c9c0, DUSK = 0xf0b98a, DAY = 0xffffff
// [minute of day, tint, strength]: linear in between
const STOPS: [number, number, number][] = [[0, NIGHT, 1], [5 * 60 + 30, NIGHT, 1], [6 * 60 + 15, DAWN, 0.6], [7 * 60, DAY, 0], [17 * 60 + 30, DAY, 0], [18 * 60 + 15, DUSK, 0.6], [19 * 60, NIGHT, 1], [24 * 60, NIGHT, 1]]
export function ambientAt(minuteOfDay: number): Ambient {
  const m = ((minuteOfDay % 1440) + 1440) % 1440
  const i = STOPS.findIndex(([t]) => t > m), [t1, c1, s1] = STOPS[i - 1] ?? STOPS[0], [t2, c2, s2] = STOPS[i] ?? STOPS[STOPS.length - 1]
  const f = t2 === t1 ? 0 : (m - t1) / (t2 - t1)
  const lampsOn = m < 6 * 60 + 15 || m >= 18 * 60 + 15
  return { tint: mix(c1, c2, f), strength: lerp(s1, s2, f), lamps: lampsOn }
}
/** Minutes since local midnight in a time zone (default Bangkok, the first users' zone). */
export function minuteOfDay(now = new Date(), timeZone = 'Asia/Bangkok'): number {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  return Number(p.find((x) => x.type === 'hour')!.value) * 60 + Number(p.find((x) => x.type === 'minute')!.value)
}
