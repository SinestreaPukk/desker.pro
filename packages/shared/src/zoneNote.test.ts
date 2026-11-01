import test from 'node:test'
import assert from 'node:assert/strict'
import { zoneNote, ZONE_NOTE_GAP_MS } from './zoneNote.ts'

test('a zone note shows once a minute per zone, each zone on its own clock', () => {
  const last = {}
  assert.equal(zoneNote(last, 'library', 0), 'Library · quiet zone')
  assert.equal(zoneNote(last, 'library', ZONE_NOTE_GAP_MS - 1), null)
  assert.equal(zoneNote(last, 'lounge', 1000), 'Lounge')
  assert.equal(zoneNote(last, 'library', ZONE_NOTE_GAP_MS), 'Library · quiet zone')
})
