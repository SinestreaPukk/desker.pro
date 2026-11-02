// The Thai + English filter (SPEC §6.3, §12): bad words become ★. It is a speed bump for a student study space, not a moderation system (reports and bans are the real tools).
// English: whole words with -s/-ed/-ing, and the simple evasions: stretched letters (fuuuck), leetspeak (sh1t, $hit), letters split by spaces or dots (f u c k).
// Thai has no spaces, so Thai terms match anywhere. Course codes (DTIP 122, DTIP122) are never touched. Lists live in wordlist.js.
import { EN, TH } from './wordlist.js'

const squash = (w) => w.toLowerCase().replace(/(.)\1+/gu, '$1') // "fuuuck" and "fuck" are the same word; both sides are squashed, so "asshole" still matches
const BAD = new Set(EN.flatMap((w) => [w, `${w}s`, `${w}ed`, `${w}ing`]).map(squash))
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' }
const COURSE = /^[A-Za-z]{2,6}\d{2,5}$/u
const stars = (n) => '★'.repeat(n)
const thRe = new RegExp(TH.join('|'), 'gu')
const SPLIT = /(?<![\p{L}\p{N}])\p{L}(?:[ ._*-]\p{L}){2,}(?![\p{L}\p{N}])/gu // f u c k, f.u.c.k
const TOKEN = /[\p{L}\p{N}@$]+/gu

const isBad = (word) => BAD.has(squash(word))
const deleet = (t) => (/\p{L}/u.test(t) ? t.replace(/[0134 57@$]/gu, (c) => LEET[c] ?? c).replace(/ /g, '') : t)

export const maskBadWords = (text) => {
  let out = text.replace(SPLIT, (m) => (isBad(m.replace(/[^\p{L}]/gu, '')) ? stars([...m].length) : m))
  out = out.replace(TOKEN, (t) => (!COURSE.test(t) && (isBad(t) || isBad(deleet(t))) ? stars([...t].length) : t))
  return out.replace(thRe, (m) => stars([...m].length))
}
