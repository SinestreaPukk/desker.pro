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
  interact: () => void = () => {} // the Sit/Stand button: the same as pressing X
  /** React tells the scene a village timer started (true) or ended (false). */
  timer: (on: boolean) => void = () => {}
  /** A red pin on the Board in the world while something is due within 24 hours. */
  boardPin: (red: boolean, question?: boolean) => void = () => {}
  /** Study together: walk to my desk; warmer light during a break. */
  walkToDesk: (spotId: string) => void = () => {}
  groupBreak: (on: boolean) => void = (on) => { this.breakOn = on } // remembered, so a scene that starts later still gets the warm light
  breakOn = false
  /** Something new went on the Board while you are here: the pins pulse gently. */
  boardPulse: () => void = () => {}
  /** Phase 1 CP3: Do Not Disturb, and what you can do about another person (all set by the scene). */
  toggleDnd: () => void = () => {}
  /** Minimap: where everyone is (tiles), and click-to-walk to a tile. */
  positions: () => { userId: string; x: number; y: number }[] = () => []
  walkToTile: (x: number, y: number) => void = () => {}
  follow: (userId: string, once?: boolean) => void = () => {} // once = walk over and stop ("Walk to"); otherwise keep following until a movement key or Esc
  stopFollow: () => void = () => {}
  fromServer(m: ServerMsg) { if (this.handler) this.handler(m); else this.held.push(m) }
  attach(h: (m: ServerMsg) => void) { this.handler = h; this.held.splice(0).forEach(h) }
}
