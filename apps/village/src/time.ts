// "5 minutes ago" in the person's language (Intl does the wording, so Thai comes free).
import { getLang } from './i18n.ts'
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [['day', 1440], ['hour', 60], ['minute', 1]]
export const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000))
  if (m < 2) return getLang() === 'th' ? 'เมื่อสักครู่' : 'just now'
  const [unit, size] = UNITS.find(([, s]) => m >= s)!
  return new Intl.RelativeTimeFormat(getLang(), { numeric: 'always' }).format(-Math.round(m / size), unit)
}
