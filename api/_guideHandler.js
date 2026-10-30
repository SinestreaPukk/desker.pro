// Goal-discovery questionnaire (served through /api/chat, as Vercel's Hobby plan allows 12 functions): turns the answers into draft goals ("build"), or rephrases one goal ("rewrite").
import { guard, askJSON } from './_ai.js'
import { SYSTEM, REWRITE_SYSTEM, cleanRequest, userMessage, validate, validateRewrite, twice } from './_guide.js'

export default async function guideHandler(req, res) {
  if (!(await guard(req, res))) return
  const body = req.body || {}
  if (JSON.stringify(body).length > 60_000) return res.status(400).json({ error: 'Invalid or too large request' })
  try {
    if (body.mode === 'guide-rewrite') {
      const g = body.goal
      if (typeof g?.title !== 'string' || !g.title.trim()) return res.status(400).json({ error: 'Invalid request' })
      const goal = JSON.stringify({ title: g.title, area: g.area, level: g.level, why: g.why }).slice(0, 2000)
      return res.json(await twice(() => askJSON({ req, kind: 'guide-rewrite', system: REWRITE_SYSTEM, messages: [{ role: 'user', content: goal }], max_tokens: 500 }), validateRewrite))
    }
    const clean = cleanRequest(body)
    if (!clean) return res.status(400).json({ error: 'Invalid or too large request' })
    res.json(await twice(() => askJSON({ req, kind: 'guide', system: SYSTEM, messages: [{ role: 'user', content: userMessage(clean) }], max_tokens: 4000 }), validate))
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
