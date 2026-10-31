import test from 'node:test'
import assert from 'node:assert/strict'
import { mailHtml, mailText } from '../api/_mail.js'

const c = { title: 'Hi <b>', lines: ['A "quoted" line & more'], button: { label: 'Go', url: 'https://x.test/a?b=1&c=2' }, note: 'Bye' }

test('html escapes text, keeps the link and has a plain-text twin', () => {
  const h = mailHtml(c, 'https://x.test')
  assert.match(h, /Hi &lt;b&gt;/)
  assert.match(h, /&quot;quoted&quot; line &amp; more/)
  assert.match(h, /href="https:\/\/x\.test\/a\?b=1&amp;c=2"/)
  assert.match(h, /src="https:\/\/x\.test\/pixel\/email-banner\.png"/)
  assert.match(mailText(c), /Go: https:\/\/x\.test\/a\?b=1&c=2/)
})
test('a mail without a button has none', () => assert.doesNotMatch(mailHtml({ title: 't', lines: ['l'] }, ''), /Button not working/))
