// A person's own display and key choices (this device). Read at start-up; changes that the canvas needs apply on the next open.
import { setKeyOverrides, type Action } from '@desker/shared'

export type A11y = { reduceMotion: boolean; bigBubbles: boolean; contrast: boolean; cbSafe: boolean }
const rd = <T,>(k: string, d: T): T => { try { return { ...d, ...JSON.parse(localStorage.getItem(k) ?? '{}') } } catch { return d } }
export const a11y = (): A11y => {
  const saved = rd<Partial<A11y>>('village.a11y', {})
  return { reduceMotion: saved.reduceMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches, bigBubbles: !!saved.bigBubbles, contrast: !!saved.contrast, cbSafe: !!saved.cbSafe }
}
export const saveA11y = (a: A11y) => { localStorage.setItem('village.a11y', JSON.stringify(a)); applyA11y() }
/** CSS hooks on <html>: the panels restyle themselves from these. */
export function applyA11y() {
  const a = a11y(), c = document.documentElement.classList
  c.toggle('rm', a.reduceMotion); c.toggle('big', a.bigBubbles); c.toggle('hc', a.contrast); c.toggle('cb', a.cbSafe)
}
export const keyChoices = (): Partial<Record<Action, string>> => rd('village.keys', {})
export const saveKeys = (o: Partial<Record<Action, string>>) => { localStorage.setItem('village.keys', JSON.stringify(o)); setKeyOverrides(o) }
export const initPrefs = () => { setKeyOverrides(keyChoices()); applyA11y() }
