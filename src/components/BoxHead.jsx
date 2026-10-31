// The top of a Today box: the tab and one plain sentence on the left, the buttons on the right.
// Buttons sit beside the text instead of under it, so opening a box or needing an action never pushes the content down.
// On a narrow phone the buttons wrap onto their own line, still on the right.
export default function BoxHead({ tab, tabClass = 'px-tab-ando', line, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 flex-1 basis-60">
        <h2 className={`px-tab ${tabClass} inline-block`}>{tab}</h2>
        {line && <p className="mt-2 break-words">{line}</p>}
      </div>
      {children && <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-2">{children}</div>}
    </div>
  )
}
