// Minimal RGBA PNG encoder + a tiny pixel canvas, so the placeholder art needs no image library.
import { deflateSync } from 'node:zlib'

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data]), c = Buffer.alloc(4); c.writeUInt32BE(crc(body))
  return Buffer.concat([len, body, c])
}
export function encodePng(w: number, h: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1) }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

export const hex = (s: string): [number, number, number, number] => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 255]

/** A pixel canvas with an origin offset, so one sheet can be drawn tile by tile. */
export class Canvas {
  w: number
  h: number
  data: Uint8Array
  constructor(w: number, h: number) { this.w = w; this.h = h; this.data = new Uint8Array(w * h * 4) }
  px(x: number, y: number, c: string | null, ox = 0, oy = 0) {
    x += ox; y += oy
    if (!c || x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.data.set(hex(c), (y * this.w + x) * 4)
  }
  /** Alpha-blend a colour over what is already there (soft shadows). */
  blend(x: number, y: number, w: number, h: number, c: string, a: number, ox = 0, oy = 0) {
    const [r, g, b] = hex(c)
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const X = x + i + ox, Y = y + j + oy; if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) continue
      const k = (Y * this.w + X) * 4; if (!this.data[k + 3]) continue // only shade what exists
      this.data[k] += (r - this.data[k]) * a; this.data[k + 1] += (g - this.data[k + 1]) * a; this.data[k + 2] += (b - this.data[k + 2]) * a
    }
  }
  rect(x: number, y: number, w: number, h: number, c: string | null, ox = 0, oy = 0) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c, ox, oy) }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string, ox = 0, oy = 0) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.px(x, y, c, ox, oy)
  }
  toPng() { return encodePng(this.w, this.h, this.data) }
}
