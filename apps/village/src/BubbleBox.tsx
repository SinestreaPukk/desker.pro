// The bubble box (T or Enter): 120-character counter, @mention autocomplete, Enter sends, Esc cancels.
import { useEffect, useMemo, useRef, useState } from 'react'
import { BUBBLE_MAX_CHARS } from '@desker/shared'

export default function BubbleBox({ names, me, initial, shake, notice, onSend, onClose }: { names: string[]; me: string; initial: string; shake: number; notice: string; onSend: (t: string) => void; onClose: () => void }) {
  const [text, setText] = useState(initial), [pick, setPick] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])
  const len = [...text].length
  const frag = /@([^@]*)$/.exec(text)?.[1] // what has been typed after the last @
  const options = useMemo(() => frag === undefined || frag.length > 24 ? [] : names.filter((n) => n !== me && n.toLowerCase().startsWith(frag.toLowerCase()) && n.length > frag.length).slice(0, 5), [frag, names, me])
  const complete = (n: string) => { setText((t) => t.replace(/@[^@]*$/, '@' + n + ' ')); setPick(0); input.current?.focus() }
  const change = (v: string) => { setText([...v].slice(0, BUBBLE_MAX_CHARS).join('')); setPick(0) }
  const key = (e: React.KeyboardEvent) => {
    e.nativeEvent.stopPropagation() // Enter also means "talk" to the page; it must not reopen the box we are closing
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (options.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setPick((p) => (p + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length) }
    else if (options.length && (e.key === 'Tab' || e.key === 'Enter')) { e.preventDefault(); complete(options[pick] ?? options[0]) }
    else if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); if (text.trim()) onSend(text) } // isComposing: Thai and other IME users confirm with Enter first
  }
  return (
    <div className={'bubblebox' + (shake ? ' shake' : '')} key={shake} role="dialog" aria-label="Say something">
      {options.length > 0 && <ul className="mentions" role="listbox">{options.map((n, i) => <li key={n} role="option" aria-selected={i === pick} className={i === pick ? 'on' : ''} onMouseDown={(e) => { e.preventDefault(); complete(n) }}>@{n}</li>)}</ul>}
      <input ref={input} value={text} onChange={(e) => change(e.target.value)} onKeyDown={key} placeholder="Say something…  (@ to mention)" aria-label="Your bubble" autoComplete="off" />
      <span className={'count' + (len >= BUBBLE_MAX_CHARS ? ' full' : '')}>{len}/{BUBBLE_MAX_CHARS}</span>
      {notice && <em role="alert">{notice}</em>}
    </div>
  )
}
