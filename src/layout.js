// Side-by-side lanes for overlapping time blocks. Input [{s, e}] in minutes; returns the same
// blocks with `lane` and `lanes` (how many lanes share its overlapping cluster).
export function lanes(blocks) {
  const list = blocks.map((b) => ({ ...b })).sort((a, b) => a.s - b.s || a.e - b.e)
  let cluster = [], end = -1
  const close = () => { const n = Math.max(0, ...cluster.map((b) => b.lane + 1)); cluster.forEach((b) => (b.lanes = n)); cluster = [] }
  for (const b of list) {
    if (b.s >= end) { close(); end = -1 }
    const used = cluster.filter((c) => c.e > b.s).map((c) => c.lane)
    b.lane = 0
    while (used.includes(b.lane)) b.lane++
    cluster.push(b); end = Math.max(end, b.e)
  }
  close()
  return list
}
