// The one way tasks get created. The UI (form, dump box, deadline options) uses it, and so can any
// future source (e.g. a LINE webhook) that writes into the same workspace document.
export function addTasks(tasks, items) {
  const base = Math.max(Date.now(), ...tasks.map((t) => t.id + 1))
  return [...tasks, ...items.filter((i) => i.title?.trim()).map((i, k) => ({ done: false, happy: 50, ...i, title: i.title.trim(), id: base + k }))]
}
