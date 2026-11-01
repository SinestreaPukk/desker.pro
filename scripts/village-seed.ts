// DEV ONLY: creates a village and prints a real invite link (members normally make villages at /new and invites in the app).
//   set -a; . ./.env.local; set +a; node scripts/village-seed.ts --name "Med Year 1 Study Den" --owner you@example.com --courses DTIP122,ANAT101
import { parseArgs } from 'node:util'
import { sql } from '../api/_store.js'
import { slugify } from '../packages/db/keys.js'
import { newCode } from '../apps/village/api/village/_manage.js'

const { values: a } = parseArgs({ options: { name: { type: 'string' }, owner: { type: 'string' }, courses: { type: 'string', default: '' }, base: { type: 'string', default: process.env.VILLAGE_URL ?? 'http://village.desker.test:5174' } } })
if (!a.name || !a.owner) { console.error('Usage: village-seed.ts --name "..." --owner <email> [--courses A,B] [--base <village url>]'); process.exit(1) }

const [owner] = await sql.query('select id from "user" where lower(email) = lower($1)', [a.owner])
if (!owner) { console.error(`No Desker account with email ${a.owner}. Sign up on desker.dev first.`); process.exit(1) }
const slug = slugify(a.name!)
const courses = a.courses!.split(',').map((c) => c.trim().toUpperCase().replace(/\s+/g, '')).filter(Boolean)
const [v] = await sql.query(
  `insert into village (slug, name, owner_id, course_tags, settings) values ($1, $2, $3, $4, $5) returning id`,
  [slug, a.name, owner.id, courses, JSON.stringify({ library_auto_focus: true })])
await sql.query(`insert into village_member (village_id, user_id, role) values ($1, $2, 'owner')`, [v.id, owner.id])
const code = newCode()
await sql.query(`insert into village_invite (code, village_id, created_by, max_uses) values ($1, $2, $3, 25)`, [code, v.id, owner.id])
console.log(`\nCreated "${a.name}" (${slug}). Courses: ${courses.join(', ') || 'none'}\nInvite link (25 uses):\n  ${a.base}/i/${code}\n`)
