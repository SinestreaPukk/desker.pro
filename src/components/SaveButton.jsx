import { createContext, useContext } from 'react'
import { btn, BLUE, ghost } from '../ui.js'

// The Save button, placed right next to anything the user edits. Everything autosaves; this sends it now and says whether it got there.
// App provides { status, save } from useSync.
export const SyncContext = createContext({ status: 'saved', save() {} })

export default function SaveButton({ className = '' }) {
  const { status, save } = useContext(SyncContext)
  const saving = status === 'saving'
  return (
    <button type="button" className={`${btn} ${status === 'saved' ? ghost : BLUE} ${className}`} disabled={saving} onClick={save} aria-live="polite">
      {saving ? 'Saving…' : status === 'offline' ? 'Retry save' : 'Save'}<span className="sr-only">{status === 'saved' ? ', all changes saved' : ''}</span>
    </button>
  )
}
