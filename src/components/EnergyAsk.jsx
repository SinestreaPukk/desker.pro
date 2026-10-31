import { btn, ghost } from '../ui.js'

// "How is your energy now?" in one tap. Shown after a focus session; the answer is a data point for the rhythm engine.
export default function EnergyAsk({ onTap, onSkip }) {
  return (
    <section role="group" aria-label="How is your energy" className="px-panel flex flex-wrap items-center gap-2 bg-yuki-0 p-3">
      <p className="w-full">Nice work. How is your energy now?</p>
      {['low', 'medium', 'high'].map((l) => <button key={l} className={`${btn} ${ghost} capitalize`} onClick={() => onTap(l)}>{l}</button>)}
      <button className={`${btn} ml-auto`} onClick={onSkip}>Not now</button>
    </section>
  )
}
