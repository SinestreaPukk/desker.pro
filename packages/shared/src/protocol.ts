// SPEC §10, Phase 0 messages. Validated with zod on BOTH ends; unknown or invalid messages are dropped.
import { z } from 'zod'
import { ACTIVITIES, COLOURS } from './types.ts'
import { BUBBLE_MAX_CHARS } from './constants.ts'

const dir = z.enum(['up', 'down', 'left', 'right'])
const presence = z.enum(['available', 'focusing', 'dnd', 'away'])
const zone = z.enum(['plaza', 'library', 'tables', 'lounge', 'garden'])
const id = z.string().min(1).max(64)
const tile = z.number().int().min(0).max(1000)
const coord = z.number().min(0).max(1000) // a position in tiles; tile t is centred on t, so a person between two tiles has a fraction
export const status = z.object({
  courseCode: z.string().max(16).optional(), activity: z.enum(ACTIVITIES),
  taskId: id.optional(), taskTitle: z.string().max(120).optional(), endsAt: z.string().datetime().optional(),
})
const member = z.object({ userId: id, name: z.string().max(60), colour: z.enum(COLOURS), role: z.enum(['owner', 'admin', 'member', 'guest']) })
const rotation = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
const placement = z.object({ id: id, decorId: id, x: tile, y: tile, rotation, by: id })
const mapOp = z.discriminatedUnion('k', [z.object({ k: z.literal('put'), p: placement }), z.object({ k: z.literal('del'), id })])
const mapEdit = z.discriminatedUnion('t', [
  z.object({ t: z.literal('place'), decorId: id, x: tile, y: tile, rotation }),
  z.object({ t: z.literal('remove'), placementId: id }),
  z.object({ t: z.literal('move'), placementId: id, x: tile, y: tile }),
  z.object({ t: z.literal('rotate'), placementId: id, rotation }),
])
const boardItem = z.object({
  key: z.string(), kind: z.enum(['due', 'exam']), courseCode: z.string().nullable(), title: z.string(), dueAt: z.string(), userIds: z.array(id),
})

export const clientMsg = z.discriminatedUnion('t', [
  z.object({ t: z.literal('hello'), v: z.number().int(), token: z.string().max(2000) }),
  z.object({ t: z.literal('move'), x: coord, y: coord, dir, seq: z.number().int().nonnegative() }),
  z.object({ t: z.literal('say'), text: z.string().min(1).max(BUBBLE_MAX_CHARS) }),
  z.object({ t: z.literal('sit'), spotId: id }),
  z.object({ t: z.literal('stand') }),
  z.object({ t: z.literal('status'), status }),
  z.object({ t: z.literal('presence'), presence: z.enum(['available', 'focusing', 'away', 'dnd']) }),
  z.object({ t: z.literal('emote'), id: z.number().int().min(1).max(8), to: id.optional() }),
  z.object({ t: z.literal('knock'), userId: id }),
  z.object({ t: z.literal('focus.start'), taskId: id.optional(), plannedMin: z.number().int().min(1).max(600) }),
  z.object({ t: z.literal('focus.stop') }),
  z.object({ t: z.literal('focus.pause') }), z.object({ t: z.literal('focus.resume') }),
  z.object({ t: z.literal('claimDesk'), spotId: id }),
  z.object({ t: z.literal('mod.remove'), userId: id, at: z.number() }), // a moderator removes one bubble from everyone's 24 h log
  z.object({ t: z.literal('log') }), // ask for the last 24 hours of bubbles I was able to see
  z.object({ t: z.literal('map.edit'), base: z.number().int().min(0), edit: mapEdit }), // base = the map version the person was looking at
  z.object({ t: z.literal('map.restore'), version: z.number().int().min(1) }), // owner only: put the map back to a snapshot (itself a new version)
  z.object({ t: z.literal('map.snapshot') }), // owner only: save a snapshot now
  z.object({ t: z.literal('ping'), ts: z.number() }),
])
export type ClientMsg = z.infer<typeof clientMsg>

export const serverMsg = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('welcome'), self: member, members: z.array(member),
    positions: z.record(z.object({ x: tile, y: tile, dir })), presence: z.record(presence), statuses: z.record(status),
    desks: z.record(id), focus: z.record(z.object({ startedAt: z.number(), endsAt: z.number(), pausedAt: z.number().optional() })), sitting: z.record(id), board: z.array(boardItem), mapVersion: z.number().int(), placements: z.array(placement),
  }),
  z.object({ t: z.literal('joined'), member }),
  z.object({ t: z.literal('left'), userId: id }),
  z.object({ t: z.literal('moved'), moves: z.array(z.object({ userId: id, x: coord, y: coord, dir, seq: z.number().int() })) }), // batched every 50 ms
  z.object({ t: z.literal('correct'), x: tile, y: tile }),
  // text + zoneId, or nearbyOnly: true for the "…" indicator
  z.object({ t: z.literal('said'), userId: id, text: z.string().max(BUBBLE_MAX_CHARS).optional(), zoneId: zone.optional(), nearbyOnly: z.literal(true).optional(), mentionsYou: z.literal(true).optional() }),
  z.object({ t: z.literal('sat'), userId: id, spotId: id }),
  z.object({ t: z.literal('stood'), userId: id }),
  z.object({ t: z.literal('deskClaimed'), userId: id, spotId: id }), // a seated member made this desk theirs (replaces any desk they had)
  z.object({ t: z.literal('statusChanged'), userId: id, status: status.nullable() }),
  z.object({ t: z.literal('presenceChanged'), userId: id, presence }),
  z.object({ t: z.literal('focusChanged'), userId: id, endsAt: z.number().nullable(), startedAt: z.number().optional(), pausedAt: z.number().optional() }), // epoch ms; startedAt lets friends draw the ring's progress (extension to SPEC §10)
  z.object({ t: z.literal('board'), items: z.array(boardItem) }),
  z.object({ t: z.literal('queued'), items: z.array(z.object({ kind: z.enum(['mention', 'knock', 'answer']), fromUserId: id, name: z.string().max(60).optional(), text: z.string().max(BUBBLE_MAX_CHARS).optional() })) }),
  z.object({ t: z.literal('emoted'), userId: id, id: z.number().int().min(1).max(8), to: id.optional() }),
  // questions (CP5): the API stores them and tells the room. `text` is present only for people who could see a bubble from the asker.
  z.object({ t: z.literal('asked'), qid: id, userId: id, text: z.string().max(200).optional(), nearbyOnly: z.literal(true).optional() }),
  z.object({ t: z.literal('answered'), qid: id, byUserId: id, name: z.string().max(60) }),
  z.object({ t: z.literal('qupdate'), qid: id }),
  z.object({ t: z.literal('knocked'), fromUserId: id, name: z.string().max(60) }),
  z.object({ t: z.literal('away'), items: z.array(z.object({ kind: z.enum(['mention', 'knock', 'answer']), fromUserId: id, name: z.string().max(60).optional(), text: z.string().max(BUBBLE_MAX_CHARS).optional() })) }), // what you missed while in Do Not Disturb
  z.object({ t: z.literal('log'), items: z.array(z.object({ zoneId: zone, userId: id, name: z.string().max(60), text: z.string().max(BUBBLE_MAX_CHARS), at: z.number() })) }),
  z.object({ t: z.literal('mapPatch'), version: z.number().int(), ops: z.array(mapOp) }), // every change to the map, in order; applying them to version-1 gives version
  z.object({ t: z.literal('mapRefused'), reason: z.string().max(30), version: z.number().int() }), // an edit was refused; `version` is the room's current one
  z.object({ t: z.literal('error'), code: z.string(), message: z.string() }),
  z.object({ t: z.literal('pong'), ts: z.number() }),
])
export type ServerMsg = z.infer<typeof serverMsg>
