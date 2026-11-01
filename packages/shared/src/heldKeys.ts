// Which direction keys are held (latest wins), and whether Shift is down. Game keys are ignored while any text input has focus (SPEC §5.1).
import { actionOf, isTyping } from './keybindings.ts'
import type { Dir } from './types.ts'

const DIRS = ['up', 'down', 'left', 'right']
type Target = { addEventListener: (t: string, f: (e: any) => void) => void; removeEventListener: (t: string, f: (e: any) => void) => void }

export function heldKeys(target: Target, typing: () => boolean = () => isTyping()) {
  const held: Dir[] = []
  let shift = false
  const drop = (d: Dir) => { const i = held.indexOf(d); if (i >= 0) held.splice(i, 1) }
  const clear = () => { held.length = 0; shift = false }
  const down = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const a = actionOf(e.key, typing())
    if (a === 'run') shift = true
    else if (a && DIRS.includes(a)) { if (!held.includes(a as Dir)) held.push(a as Dir); e.preventDefault?.() }
    if (!typing()) shift = e.shiftKey
  }
  const up = (e: KeyboardEvent) => { // releasing always counts, even if focus moved into an input meanwhile
    const a = actionOf(e.key, false)
    if (a && DIRS.includes(a)) drop(a as Dir)
    shift = e.shiftKey
  }
  target.addEventListener('keydown', down); target.addEventListener('keyup', up)
  target.addEventListener('blur', clear); target.addEventListener('focusin', clear)
  return {
    dir: (): Dir | undefined => held[held.length - 1],
    run: () => shift,
    destroy() { target.removeEventListener('keydown', down); target.removeEventListener('keyup', up); target.removeEventListener('blur', clear); target.removeEventListener('focusin', clear) },
  }
}
