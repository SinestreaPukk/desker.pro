import test from 'node:test'
import assert from 'node:assert/strict'
import { fmtDuration, relDate } from '../src/format.js'

test('durations are rounded and human', () => {
  assert.equal(fmtDuration(0.75), '45 min')
  assert.equal(fmtDuration(0.8), '48 min')
  assert.equal(fmtDuration(1.5), '1 h 30 min')
  assert.equal(fmtDuration(4), '4 h')
  assert.equal(fmtDuration(0), '0 min')
})
test('relative dates', () => {
  assert.equal(relDate('2026-10-30', '2026-10-30'), 'Today')
  assert.equal(relDate('2026-10-31', '2026-10-30'), 'Tomorrow')
  assert.equal(relDate('2026-11-03', '2026-10-30'), 'In 4 days')
  assert.equal(relDate('2026-10-29', '2026-10-30'), 'Yesterday')
  assert.equal(relDate('2026-10-27', '2026-10-30'), '3 days ago')
})
