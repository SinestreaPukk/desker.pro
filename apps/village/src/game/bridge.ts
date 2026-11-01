import type { Presence, ServerMsg, Status, ZoneId } from '@desker/shared'

export interface RosterItem { userId: string; zone: ZoneId; atDesk: boolean; presence: Presence; status?: Status; endsAt?: number }

/** The seam between React (which owns the network connection) and the Phaser scene. Messages that arrive before the scene is ready are held. */
export class Bridge {
  private handler?: (m: ServerMsg) => void
  private held: ServerMsg[] = []
  /** Set by React: how the scene sends to the room. */
  out: (m: object) => void = () => {}
  /** Set by the scene: where everyone is right now (for the member list), pan the camera to someone for 2 s, and flip Focusing on or off. */
  roster: () => RosterItem[] = () => []
  locate: (userId: string) => void = () => {}
  toggleFocus: () => void = () => {}
  /** React tells the scene a village timer started (true) or ended (false). */
  timer: (on: boolean) => void = () => {}
  /** A red pin on the Board in the world while something is due within 24 hours. */
  boardPin: (on: boolean) => void = () => {}
  fromServer(m: ServerMsg) { if (this.handler) this.handler(m); else this.held.push(m) }
  attach(h: (m: ServerMsg) => void) { this.handler = h; this.held.splice(0).forEach(h) }
}
