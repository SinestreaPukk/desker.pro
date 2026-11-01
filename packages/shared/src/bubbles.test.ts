import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanBubble, parseMentions, visibility, rateCheck, type Party } from './bubbles.ts'
import { maskBadWords } from './wordfilter.js'

const at = (x: number, y: number, zone: Party['zone'] = 'plaza', table: number | null = null): Party => ({ x, y, zone, table })

test('visibility: within 5 tiles you see it, 5-12 tiles you see "...", beyond that nothing', () => {
  const s = at(19, 14)
  assert.equal(visibility(s, at(23, 14), false), 'full') // 4 tiles
  assert.equal(visibility(s, at(24, 14), false), 'full') // exactly 5
  assert.equal(visibility(s, at(27, 14), false), 'hint') // 8 tiles
  assert.equal(visibility(s, at(31, 14), false), 'hint') // exactly 12
  assert.equal(visibility(s, at(32, 14), false), 'none')
  assert.equal(visibility(s, at(22, 18), false), 'full') // 3-4-5 triangle: distance is straight-line, not steps
})
test('visibility: a table seat talks only to that table, mentions included', () => {
  const s = at(27, 5, 'tables', 1)
  assert.equal(visibility(s, at(28, 6, 'tables', 1), false), 'full')
  assert.equal(visibility(s, at(28, 6, 'tables', 2), false), 'none')
  assert.equal(visibility(s, at(28, 7, 'tables', null), true), 'none') // standing next to the table does not count
  assert.equal(visibility(s, at(19, 14, 'plaza', null), true), 'none')
})
test('visibility: the Library is quiet; only @mentions get through, and a studying receiver gets them later', () => {
  const lib = at(5, 5, 'library'), out = at(8, 12)
  assert.equal(visibility(lib, at(6, 5, 'library'), false), 'none')
  assert.equal(visibility(lib, out, false), 'none') // speaking from inside, nobody outside hears
  assert.equal(visibility(out, lib, false), 'none') // speaking to the Library from outside
  assert.equal(visibility(out, lib, true), 'queued') // mentioned inside: held until they stop studying
  assert.equal(visibility(lib, out, true), 'full') // mentioned outside: delivered now
  assert.equal(visibility(lib, at(6, 5, 'library'), true), 'queued')
  assert.equal(visibility(lib, at(30, 20, 'garden'), true), 'full') // a mention beats distance
})
test('parseMentions: exact names, spaces, case, Thai, no partial matches', () => {
  const names = ['Ann', 'Anna', 'Test Friend', 'สมชาย']
  assert.deepEqual(parseMentions('hi @ann!', names), ['Ann'])
  assert.deepEqual(parseMentions('@Anna and @Ann', names).sort(), ['Ann', 'Anna'])
  assert.deepEqual(parseMentions('@Anna', names), ['Anna']) // not also Ann
  assert.deepEqual(parseMentions('hey @test friend, look', names), ['Test Friend'])
  assert.deepEqual(parseMentions('@สมชาย ช่วยหน่อย', names), ['สมชาย'])
  assert.deepEqual(parseMentions('email me at ann@x.com', names), []) // no @ right before the name
  assert.deepEqual(parseMentions('@Annabel', names), [])
})
test('cleanBubble: strips control characters, tidies spaces, caps at 120, masks bad words', () => {
  assert.equal(cleanBubble('  hi\u0000 \n there\t'), 'hi there')
  assert.equal(cleanBubble('x'.repeat(300)).length, 120)
  assert.equal(cleanBubble('   '), '')
  assert.equal(cleanBubble('<b>hi</b>'), '<b>hi</b>') // text is kept as text; the client never renders it as HTML
  assert.equal([...cleanBubble('ก'.repeat(200))].length, 120) // counted in characters, not bytes
})
test('word filter: English whole words and Thai terms become stars; innocent words survive', () => {
  assert.equal(maskBadWords('what the fuck'), 'what the ★★★★')
  assert.equal(maskBadWords('Shit happens'), '★★★★ happens')
  assert.equal(maskBadWords('class assignment, Scunthorpe, shitake'), 'class assignment, Scunthorpe, shitake') // no matches inside other words
  assert.equal(maskBadWords('ไอ้สัตว์ มาแล้ว'), '★★★★★★ มาแล้ว'.replace('★★★★★★', '★'.repeat([...'ไอ้สัตว์'].length)))
  assert.equal(maskBadWords('hello'), 'hello')
})
test('rateCheck: 5 per 10 seconds, then it recovers', () => {
  let t: number[] = [], ok = true
  for (let i = 0; i < 5; i++) { ({ ok, times: t } = rateCheck(t, 1000 + i * 100)); assert.ok(ok) }
  const sixth = rateCheck(t, 1600); assert.ok(!sixth.ok); assert.equal(sixth.times.length, 5) // a refused bubble does not count
  assert.ok(!rateCheck(t, 10_999).ok) // the first one was at 1000 and is still inside the window
  assert.ok(rateCheck(t, 11_001).ok) // once the oldest is 10 s old there is room
})

test('a running focus timer is as quiet as the Library: only @mentions, queued', async () => {
  const { visibility } = await import('./bubbles.ts')
  const s = { x: 5, y: 20, zone: 'plaza' as const, table: null }, r = { x: 6, y: 20, zone: 'plaza' as const, table: null, focus: true }
  assert.equal(visibility(s, r, false), 'none')
  assert.equal(visibility(s, r, true), 'queued')
  assert.equal(visibility(s, { ...r, focus: false }, false), 'full')
})
