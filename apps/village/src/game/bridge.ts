import type { ServerMsg } from '@desker/shared'

/** The seam between React (which owns the network connection) and the Phaser scene. Messages that arrive before the scene is ready are held. */
export class Bridge {
  private handler?: (m: ServerMsg) => void
  private held: ServerMsg[] = []
  /** Set by React: how the scene sends to the room. */
  out: (m: object) => void = () => {}
  fromServer(m: ServerMsg) { if (this.handler) this.handler(m); else this.held.push(m) }
  attach(h: (m: ServerMsg) => void) { this.handler = h; this.held.splice(0).forEach(h) }
}
