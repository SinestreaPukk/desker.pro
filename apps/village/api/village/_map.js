// The map's memory (Phase 2 CP1). Only the realtime room calls this (signed with the room secret, role 'map'): the room decides every edit, this
// stores the result. The current map version is max(v) of the village's placement rows, so there is no counter to drift.
import { sql } from '../../../../api/_store.js'
import { verifyToken } from '../../../../packages/shared/src/token.js'

const ID = /^[0-9a-f-]{36}$/, SNAPSHOT_EVERY = 50 // = SNAPSHOT_EVERY in packages/shared/src/mapedit.ts
const live = (vid) => sql.query(`select id, decor_id as "decorId", x, y, rotation, coalesce(placed_by, '-') as by, text from village_placement where village_id = $1 and removed_at is null order by created_at, id`, [vid])
const versionOf = async (vid) => (await sql.query('select coalesce(max(v), 0)::int as v from village_placement where village_id = $1', [vid]))[0].v
const okPut = (p) => p && ID.test(p.id) && /^[a-z0-9_-]{1,64}$/.test(p.decorId) && Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < 1000 && p.y < 1000 && [0, 90, 180, 270].includes(p.rotation) && (p.text == null || (typeof p.text === 'string' && p.text.length <= 40))

/** /api/village/room/:villageId — GET (placements + version, or ?snapshots=1, or ?snapshot=N) and POST (write one version). */
export async function mapRoom({ req, res, vid }) {
  const t = await verifyToken((req.headers.authorization ?? '').replace(/^Bearer /, ''), process.env.VILLAGE_ROOM_SECRET, vid)
  if (!ID.test(vid ?? '') || !t.ok || t.claims.role !== 'map') return res.status(403).json({ error: 'forbidden' })
  const q = new URL(req.url, 'http://x').searchParams
  if (req.method === 'GET') {
    if (q.get('snapshots')) return res.json({ snapshots: await sql.query(`select version, created_by as "by", created_at as "createdAt", jsonb_array_length(layers)::int as items from village_map_version where village_id = $1 order by version desc limit 50`, [vid]) })
    if (q.get('snapshot')) {
      const r = await sql.query('select layers from village_map_version where village_id = $1 and version = $2', [vid, Number(q.get('snapshot'))])
      return r.length ? res.json({ placements: r[0].layers }) : res.status(404).json({ error: 'not_found' })
    }
    const [placements, version] = await Promise.all([live(vid), versionOf(vid)])
    return res.json({ version, placements })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })
  const b = req.body ?? {}, ops = Array.isArray(b.ops) ? b.ops : []
  if (!Number.isInteger(b.version) || (!ops.length && !b.snapshot) || ops.length > 500 || !ops.every((o) => (o?.k === 'put' && okPut(o.p)) || (o?.k === 'del' && ID.test(o.id)))) return res.status(400).json({ error: 'Invalid' })
  const cur = await versionOf(vid)
  if (!ops.length) { // 'snapshot now' (owner): save the current map as a restore point, no new version
    if (b.version !== cur) return res.status(409).json({ error: 'version', version: cur })
  } else if (b.version !== cur + 1) return res.status(409).json({ error: 'version', version: cur }) // the room is behind (or this write was a repeat): it reloads
  const by = String(b.actor ?? '').slice(0, 64)
  const stmts = ops.map((o) => o.k === 'del'
    ? ['update village_placement set removed_at = now(), v = $3 where id = $1 and village_id = $2', [o.id, vid, b.version]]
    : ['insert into village_placement (id, village_id, decor_id, x, y, rotation, placed_by, v, text) values ($1, $2, $3, $4, $5, $6, (select id from "user" where id = $7), $8, $9) on conflict (id) do update set decor_id = excluded.decor_id, x = excluded.x, y = excluded.y, rotation = excluded.rotation, text = excluded.text, v = excluded.v, removed_at = null where village_placement.village_id = excluded.village_id',
      [o.p.id, vid, o.p.decorId, o.p.x, o.p.y, o.p.rotation, o.p.by, b.version, o.p.text ?? null]])
  if (b.version % SNAPSHOT_EVERY === 0 || b.snapshot) stmts.push([`insert into village_map_version (village_id, version, layers, created_by) select $1, $2, coalesce(jsonb_agg(jsonb_build_object('id', id, 'decorId', decor_id, 'x', x, 'y', y, 'rotation', rotation, 'by', coalesce(placed_by, '-'), 'text', text)), '[]'::jsonb), (select id from "user" where id = $3) from village_placement where village_id = $1 and removed_at is null on conflict do nothing`, [vid, b.version, by]])
  await sql.transaction((txn) => stmts.map(([text, params]) => txn.query(text, params)))
  return res.json({ ok: true, version: b.version })
}
