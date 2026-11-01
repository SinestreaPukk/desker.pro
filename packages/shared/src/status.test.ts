import test from 'node:test'
import assert from 'node:assert/strict'
import { maskStatus } from './status.ts'

const s = { courseCode: 'DTIP 122', activity: 'reading' as const, taskTitle: 'Chapter 3', endsAt: '2026-11-01T10:00:00.000Z' }
test('status sharing: full keeps everything, basic only says studying, off says nothing', () => {
  assert.deepEqual(maskStatus(s, 'full'), s)
  assert.deepEqual(maskStatus(s, 'basic'), { activity: 'other' })
  assert.equal(maskStatus(s, 'off'), null)
})
