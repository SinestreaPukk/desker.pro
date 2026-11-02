/** The phone layout (SPEC Checkpoint 10): any device whose main pointer is a finger. `?touch=1` forces it, for testing on a desktop. */
export const isTouchUi = () => matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch')

/** Low effects: less snow, no steam or dust puffs. On by choice, or by default on a weak touch device (4 cores or fewer). */
export const lowFx = () => { if (JSON.parse(localStorage.getItem('village.a11y') ?? '{}').reduceMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches) return true; const v = localStorage.getItem('village.lowfx'); return v ? v === '1' : isTouchUi() && (navigator.hardwareConcurrency ?? 8) <= 4 }
export const setLowFx = (on: boolean) => localStorage.setItem('village.lowfx', on ? '1' : '0')
