// Local stand-in for @neondatabase/serverless: the same neon() calls, answered by PGlite (Postgres in-process) from .data/pg.
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const dir = fileURLToPath(new URL('../.data/pg', import.meta.url))
mkdirSync(dir, { recursive: true })
const db = new PGlite(dir)
await db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')) // idempotent

const run = (q, text, params) => q.query(text, params).then((r) => r.rows)

export function neon() {
  const sql = (strings, ...values) => run(db, strings.reduce((a, s, i) => `${a}$${i}${s}`), values)
  sql.query = (text, params) => run(db, text, params)
  // Neon collects the queries, then runs them all in one transaction and returns each one's rows.
  sql.transaction = (build) => {
    const queries = build({ query: (text, params) => [text, params] })
    return db.transaction(async (tx) => {
      const out = []
      for (const [text, params] of queries) out.push(await run(tx, text, params))
      return out
    })
  }
  return sql
}
