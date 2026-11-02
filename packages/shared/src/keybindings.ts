// SPEC §5.1. Defined once; Phase 1 adds the remap screen. Game keys are ignored while any text input has focus.
export type Action = 'up' | 'down' | 'left' | 'right' | 'run' | 'talk' | 'interact' | 'focus' | 'members' | 'board' | 'close' | 'help'
  | 'ask' | 'join' | 'dnd' | 'emote' | 'minimap' | 'build'
export const KEYBINDINGS: { action: Action; keys: string[]; phase: 0 | 1 | 2; label: string }[] = [
  { action: 'up', keys: ['w', 'ArrowUp'], phase: 0, label: 'Walk' },
  { action: 'down', keys: ['s', 'ArrowDown'], phase: 0, label: 'Walk' },
  { action: 'left', keys: ['a', 'ArrowLeft'], phase: 0, label: 'Walk' },
  { action: 'right', keys: ['d', 'ArrowRight'], phase: 0, label: 'Walk' },
  { action: 'run', keys: ['Shift'], phase: 0, label: 'Run (hold)' },
  { action: 'talk', keys: ['t', 'Enter'], phase: 0, label: 'Talk' },
  { action: 'interact', keys: ['x'], phase: 0, label: 'Sit, stand, read the Board' },
  { action: 'focus', keys: ['f'], phase: 0, label: 'Focus timer' },
  { action: 'members', keys: ['Tab'], phase: 0, label: 'Members' },
  { action: 'board', keys: ['b'], phase: 0, label: 'Board' },
  { action: 'close', keys: ['Escape'], phase: 0, label: 'Close' },
  { action: 'help', keys: ['?'], phase: 0, label: 'Help' },
  { action: 'ask', keys: ['q'], phase: 1, label: 'Ask a question' },
  { action: 'join', keys: ['j'], phase: 1, label: 'Join a study session' },
  { action: 'dnd', keys: ['g'], phase: 1, label: 'Do not disturb' },
  { action: 'emote', keys: ['e'], phase: 1, label: 'Emote' },
  { action: 'minimap', keys: ['m'], phase: 1, label: 'Minimap' },
  { action: 'build', keys: ['Mod+b'], phase: 2, label: 'Build mode' },
]
export const isTyping = (el: Element | null = typeof document === 'undefined' ? null : document.activeElement) =>
  !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable)
// Remapping (Phase 1): a person's own single-key choices per action, kept by the app (localStorage) and set here at start-up.
export const REMAPPABLE: Action[] = ['talk', 'interact', 'focus', 'members', 'board', 'help', 'ask', 'join', 'dnd', 'emote', 'minimap']
const RESERVED = ['Escape', 'Enter', 'Shift']
let overrides: Partial<Record<Action, string>> = {}
export const setKeyOverrides = (o: Partial<Record<Action, string>>) => { overrides = { ...o } }
const norm = (k: string) => (k.length === 1 ? k.toLowerCase() : k)
/** The keys that run an action now: the person's choice if they made one, else the default. */
export const keysOf = (a: Action) => (overrides[a] ? [overrides[a]!] : KEYBINDINGS.find((b) => b.action === a)?.keys ?? [])
/** Can `key` become the key for `action`? -> null if so, else why not: 'reserved' | 'taken:<other action>' */
export function remapCheck(action: Action, key: string): string | null {
  const k = norm(key)
  if (RESERVED.includes(k) || !(k.length === 1 || k === 'Tab')) return 'reserved'
  const other = KEYBINDINGS.find((b) => b.action !== action && b.phase <= 1 && keysOf(b.action).includes(k))
  return other ? `taken:${other.action}` : null
}
/** The action for a key event, or null (also null while typing). Phase 0 keys only until `phase` is raised. */
export function actionOf(key: string, typing = isTyping(), phase = 0): Action | null {
  if (typing) return null
  const k = key.length === 1 ? key.toLowerCase() : key
  return KEYBINDINGS.find((b) => b.phase <= phase && keysOf(b.action).includes(k))?.action ?? null
}
