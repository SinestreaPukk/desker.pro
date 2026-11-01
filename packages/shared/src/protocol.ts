// SPEC §10, Phase 0 messages. Validated with zod on BOTH ends; unknown or invalid messages are dropped.
import { z } from 'zod'
import { ACTIVITIES, COLOURS } from './types.ts'
import { BUBBLE_MAX_CHARS } from './constants.ts'

const dir = z.enum(['up', 'down', 'left', 'right'])
const presence = z.enum(['available', 'focusing', 'dnd', 'away'])
const zone = z.enum(['plaza', 'library', 'tables', 'lounge', 'garden'])
const id = z.string().min(1).max(64)
const tile = z.number().int().min(0).max(1000)
export const status = z.object({
  courseCode: z.string().max(16).optional(), activity: z.enum(ACTIVITIES),
  taskId: id.optional(), taskTitle: z.string().max(120).optional(), endsAt: z.string().datetime().optional(),
})
const member = z.object({ userId: id, name: z.string().max(60), colour: z.enum(COLOURS), role: z.enum(['owner', 'admin', 'member', 'guest']) })
const boardItem = z.object({
  key: z.string(), kind: z.enum(['due', 'exam']), courseCode: z.string().nullable(), title: z.string(), dueAt: z.string(), userIds: z.array(id),
})

export const clientMsg = z.discriminatedUnion('t', [
  z.object({ t: z.literal('hello'), v: z.number().int(), token: z.string().max(2000) }),
  z.object({ t: z.literal('move'), x: tile, y: tile, dir, seq: z.number().int().nonnegative() }),
  z.object({ t: z.literal('say'), text: z.string().min(1).max(BUBBLE_MAX_CHARS) }),
  z.object({ t: z.literal('sit'), spotId: id }),
  z.object({ t: z.literal('stand') }),
  z.object({ t: z.literal('status'), status }),
  z.object({ t: z.literal('presence'), presence: z.enum(['available', 'focusing']) }), // 'dnd' joins in Phase 1
  z.object({ t: z.literal('focus.start'), taskId: id.optional(), plannedMin: z.number().int().min(1).max(600) }),
  z.object({ t: z.literal('focus.stop') }),
  z.object({ t: z.literal('claimDesk'), spotId: id }),
  z.object({ t: z.literal('ping'), ts: z.number() }),
])
export type ClientMsg = z.infer<typeof clientMsg>

export const serverMsg = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('welcome'), self: member, members: z.array(member),
    positions: z.record(z.object({ x: tile, y: tile, dir })), presence: z.record(presence), statuses: z.record(status),
    desks: z.record(id), board: z.array(boardItem), mapVersion: z.number().int(),
  }),
  z.object({ t: z.literal('joined'), member }),
  z.object({ t: z.literal('left'), userId: id }),
  z.object({ t: z.literal('moved'), moves: z.array(z.object({ userId: id, x: tile, y: tile, dir, seq: z.number().int() })) }), // batched every 50 ms
  z.object({ t: z.literal('correct'), x: tile, y: tile }),
  // text + zoneId, or nearbyOnly: true for the "…" indicator
  z.object({ t: z.literal('said'), userId: id, text: z.string().max(BUBBLE_MAX_CHARS).optional(), zoneId: zone.optional(), nearbyOnly: z.literal(true).optional() }),
  z.object({ t: z.literal('sat'), userId: id, spotId: id }),
  z.object({ t: z.literal('stood'), userId: id }),
  z.object({ t: z.literal('statusChanged'), userId: id, status: status.nullable() }),
  z.object({ t: z.literal('presenceChanged'), userId: id, presence }),
  z.object({ t: z.literal('focusChanged'), userId: id, endsAt: z.string().datetime().nullable() }),
  z.object({ t: z.literal('board'), items: z.array(boardItem) }),
  z.object({ t: z.literal('queued'), items: z.array(z.object({ kind: z.enum(['mention', 'knock']), fromUserId: id, text: z.string().max(BUBBLE_MAX_CHARS).optional() })) }),
  z.object({ t: z.literal('error'), code: z.string(), message: z.string() }),
  z.object({ t: z.literal('pong'), ts: z.number() }),
])
export type ServerMsg = z.infer<typeof serverMsg>
