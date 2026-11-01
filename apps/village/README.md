# Kodama Village (village.desker.dev)

A small 2D pixel study world for friends. Source of truth: `docs/village/SPEC.md`. Phase 0 is done (checkpoints 0 to 11); nothing here has been deployed yet.

## Architecture in 10 lines
1. `apps/village`: the web app (Vite, React, strict TypeScript). Phaser is lazy-loaded, so the village picker loads fast. React owns every panel; Phaser only draws the world.
2. `apps/village/api/village/[...all].js`: the village API, one Vercel function (a project allows 12). Same login, same Neon database, same account document as desker.dev.
3. `packages/shared`: the protocol (zod, used by the app and the room), map and walking logic, bubble rules, the Board builder, constants. Pure and unit-tested.
4. `realtime`: a Cloudflare Worker with one Durable Object per village (WebSocket Hibernation). It validates moves, relays bubbles and presence, and keeps 24 h of chat in the DO's own SQLite.
5. The API signs a 10-minute HS256 room token (`VILLAGE_ROOM_SECRET`); the Worker only verifies it. The room has no database access.
6. The database owns lasting state (members, desks, focus sessions, events); the room owns live state (positions, who sits where, timers, presence).
7. Ending a focus timer writes a normal Desker session into the account document (`api/village/_session.js`), so it shows up in desker.dev's planner and Rhythm.
8. The Board is built by the API from members' shared deadlines and polled every 5 minutes.
9. Art is drawn by scripts (`scripts/gen-*.ts`), no image library: `node scripts/gen-placeholder-assets.ts` and `node scripts/gen-snowy-campus.ts` rewrite the committed PNGs and map.
10. Analytics go to the `village_event` table, never with message text.

## Local development
Needs Node 25 (the scripts run `.ts` directly), and one `/etc/hosts` line: `127.0.0.1 desker.test village.desker.test`.

```sh
npm install
npm run dev:local                    # Desker itself, desker.test:3000 (sign-in)
npm run dev -w @desker/village       # the village, http://village.desker.test:5174
npm run dev -w @desker/realtime      # the room, ws://localhost:8787
```
**Never use `vercel dev` for village work**: it applies the cloud env over `.env.local` and would use the production database. Both dev servers read only `.env.local` through `scripts/dev-api.js`. Use a Neon branch (`village-dev`), never production.
The API's helper modules are imported once, so restart the village dev server after editing a file under `packages/shared` or `api/village/_*.js`.
Tips: `?hour=21` previews night, `?away=6000` makes idle-away quick, `?touch=1` shows the phone layout on a desktop.

## Env vars
| Where | Name | What |
|---|---|---|
| `.env.local` / Vercel (both projects) | `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | same as desker.dev |
| both | `COOKIE_DOMAIN` | `.desker.dev` in production (`.desker.test` locally) so one sign-in works on both hosts |
| Desker project | `VILLAGE_ORIGINS` | `https://village.desker.dev` (CORS for the cookie) |
| village project + Worker | `VILLAGE_ROOM_SECRET` | `openssl rand -base64 32`, the same value in both. Locally `realtime/.dev.vars` |
| village build | `VITE_API_URL`, `VITE_REALTIME_URL` | `https://desker.dev`, `wss://realtime.desker.dev` |
| Worker `[vars]` | `ALLOWED_ORIGINS` | `https://village.desker.dev` |

## Seed a village
```sh
set -a; . ./.env.local; set +a
node scripts/village-seed.ts --name "Med Year 1 Study Den" --owner you@example.com --courses DTIP122,ANAT101
```
It prints the join link once (the key is stored hashed). Send it to the group.

## Reports and tests
```sh
node scripts/village-report.ts 14        # per village per day: members, sessions, minutes present, focus minutes, bubbles, 3+ together
npm test                                 # root tests (api, session, events, report) + shared
npm test -w @desker/realtime
set -a; . realtime/.dev.vars; set +a
node scripts/room-smoke.mjs              # needs the room running; prints ROOM OK
node scripts/loadtest.ts --clients 30 --minutes 3   # bots walk and chat; reports rates, drops, Worker CPU and memory
```

## Deploy (the owner does this; nothing is automated)
**Database:** apply `db/migrations/005_village.sql` and `006_village_desk.sql` to production by hand (`psql "$DATABASE_URL" -f ...`) after trying them on a branch.
**Realtime Worker:**
```sh
cd realtime
npx wrangler login
npx wrangler secret put VILLAGE_ROOM_SECRET
# set ALLOWED_ORIGINS in wrangler.toml to https://village.desker.dev
npx wrangler deploy
```
Then add a route or custom domain `realtime.desker.dev` to the Worker.
**Village app (Vercel):** a new project from this repo, root directory `apps/village`, framework Vite, with the env vars above. Add the domain `village.desker.dev`.
**Desker project:** set `VILLAGE_ORIGINS` and `COOKIE_DOMAIN=.desker.dev`, then redeploy (the "Study in the village" button on Today needs the new build).
**DNS (village.desker.dev):** `CNAME village` -> `cname.vercel-dns.com` (or the value Vercel shows), and `CNAME realtime` -> the Worker's custom domain per Cloudflare. If DNS is on Cloudflare, set the Vercel record to "DNS only" (grey cloud).

## Known limits (Phase 0)
Walking by tap is straight lines only; the Board is read-only and polled; no invites (join links come from the seed script); the room forgets everything when it restarts except the 24 h chat log; on a very high-density phone the canvas is not DPR-aware, so it may look soft.
