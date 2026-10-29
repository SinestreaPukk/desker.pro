// One-off, safe to re-run: creates the tables in db/schema.sql, then copies the old `workspaces` documents and
// `usage` rows into them. Workspaces with no content are left behind. The old tables are never modified.
//   set -a; . ./.env.local; set +a; node scripts/migrate.mjs
import { readFileSync } from 'node:fs'
import { sql, saveDoc, hasContent } from '../api/_store.js'

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')
for (const stmt of schema.split(/;\s*\n/).map((s) => s.replace(/^(\s*--.*\n)+/gm, '').trim()).filter(Boolean)) await sql.query(stmt)
console.log('schema ready')

const rows = await sql`select uid, data from workspaces`
let moved = 0, skipped = 0
for (const { uid, data } of rows) {
  if (!/^[0-9a-f-]{36}$/.test(uid) || !hasContent(data)) { skipped++; continue }
  await saveDoc(uid, data)
  moved++
}
console.log(`workspaces: ${moved} copied, ${skipped} empty or invalid left behind`)

const [{ to_regclass: old }] = await sql`select to_regclass('public.usage')`
if (old) {
  await sql`insert into users (id) select distinct uid from usage where uid ~ '^[0-9a-f-]{36}$' on conflict do nothing`
  const r = await sql`insert into ai_calls (user_id, kind, model, input_tokens, output_tokens, created_at)
    select case when uid ~ '^[0-9a-f-]{36}$' then uid end, kind, model, input_tokens, output_tokens, ts from usage
    where not exists (select 1 from ai_calls limit 1) returning 1`
  console.log(`usage: ${r.length} calls copied`)
}
const [n] = await sql`select (select count(*) from users)::int users, (select count(*) from tasks)::int tasks, (select count(*) from projects)::int projects, (select count(*) from deadlines)::int deadlines, (select count(*) from goals)::int goals`
console.log('now in tables:', n)
