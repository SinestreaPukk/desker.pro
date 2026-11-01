// SPEC §4.4. Every timing and limit lives here; never write the number elsewhere.
export const WALK_MS_PER_TILE = 150
export const RUN_MS_PER_TILE = 90
export const MOVE_SEND_MAX_HZ = 10
export const REMOTE_INTERP_DELAY_MS = 100
export const BUBBLE_MAX_CHARS = 120
export const BUBBLE_VISIBLE_MS = 8000
export const BUBBLE_RADIUS_TILES = 5
export const BUBBLE_RATE_LIMIT = { count: 5, perMs: 10_000 }
export const AWAY_AFTER_IDLE_MS = 300_000
export const CHAT_LOG_TTL_HOURS = 24
export const VILLAGE_MAX_MEMBERS = 50
export const DEFAULT_GROUP_FOCUS_MIN = 50
export const DEFAULT_GROUP_BREAK_MIN = 10
export const TOKEN_TTL_S = 600
export const PROTOCOL_VERSION = 1
// Derived from the spec's other sections:
export const TILE_PX = 16
export const CAMERA_LERP = 0.12
export const BUBBLE_HINT_RADIUS_TILES = 12 // §6.3 rule 4: the "…" indicator
export const MOVE_SPEED_TOLERANCE = 1.2 // §3.5: run speed + 20%
export const TOKEN_REFRESH_MS = 8 * 60_000
export const RECONNECT_MS = { min: 500, max: 8000 }
/** Reconnect wait for the nth failed attempt (0-based): 0.5 s, 1, 2, 4, 8, then 8 s max (SPEC §10). */
export const reconnectDelay = (attempt: number) => Math.min(RECONNECT_MS.max, RECONNECT_MS.min * 2 ** attempt)
// Free walking (Checkpoint 5b): a small box around your feet, not a whole tile, so you slide along walls and round corners.
export const BODY_HALF_W = 0.28 // tiles
export const BODY_HALF_H = 0.2
export const WALK_TILES_PER_MS = 1 / WALK_MS_PER_TILE
export const RUN_TILES_PER_MS = 1 / RUN_MS_PER_TILE
