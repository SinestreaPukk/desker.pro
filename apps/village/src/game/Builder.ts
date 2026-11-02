// Build mode (Phase 2, CP3). All decisions come from checkEdit in @desker/shared (the same function the room runs), so the green/red ghost never disagrees
// with the room. This class owns: the ghost, selection, my pending edits, undo/redo (just more edits), other people's ghosts, and the tok sound.
import Phaser from 'phaser'
import { DECOR, REFUSAL_TEXT, ROOM_REFUSAL_TEXT, TILE_PX, checkEdit, footprint, type Dir, type Edit, type MapOp, type MapState, type Placement, type Rotation } from '@desker/shared'
import { DEPTH } from './Avatar.ts'
import type { BuildView } from './bridge.ts'

export interface Host {
  scene: Phaser.Scene
  map: () => MapState
  me: string
  nameOf: (userId: string) => string
  avatar: (userId: string) => { x: number; y: number } | undefined
  send: (m: object) => void
  occupied: () => (tile: number) => boolean
  mine: () => { x: number; y: number; facing: Dir } // my tile and the way I face
  focusing: () => boolean // edit sounds are muted while I am Focusing
  touch: boolean
  calm: boolean // reduced motion / Low effects: no dust
  publish: (v: BuildView) => void
}
type Kind = 'do' | 'undo' | 'redo'
interface Pending { edit: Edit; kind: Kind; action: Action; rekey?: string; silent?: boolean }
interface Action { before?: Placement; after?: Placement } // a placement before and after one edit (undefined = did not exist)
type Ghost = { decorId: string; x: number; y: number; rotation: Rotation; ok: boolean }
const STACK = 50
const DEP = { ghost: DEPTH.above + 10, tag: DEPTH.tag - 5 }
const FRONT: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }

export class Builder {
  on = false
  private item: string | null = null; private rot: Rotation = 0; private moving: string | null = null; private sel: string | null = null
  private hover: { x: number; y: number } | null = null
  private ok = false; private reason = ''
  private pending: Pending[] = []; private undo: Action[] = []; private redo: Action[] = []
  private ghost?: Phaser.GameObjects.Image; private box?: Phaser.GameObjects.Graphics; private msg?: Phaser.GameObjects.Text
  private others = new Map<string, { img: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; hammer: Phaser.GameObjects.Text }>()
  private sent = ''; private lastFront = ''
  constructor(private h: Host) {}

  // ---- mode ----
  set(on: boolean) {
    if (on === this.on) return
    this.on = on; this.item = null; this.moving = null; this.sel = null; this.reason = ''
    this.h.send({ t: 'build', on })
    this.sent = ''; this.draw(); this.publish()
  }
  pick(decorId: string | null) {
    if (!this.on) return
    this.item = decorId; this.moving = null; this.sel = null; this.reason = ''
    if (decorId) this.rot = DECOR[decorId].rot[0] as Rotation
    this.refresh(); this.publish()
  }
  /** Esc: drop the item in hand, then the selection, then leave build mode. */
  escape() { if (this.item) this.pick(null); else if (this.sel) { this.sel = null; this.draw(); this.publish() } else this.set(false) }

  // ---- pointer ----
  point(tile: { x: number; y: number } | null) { if (!this.on || this.h.touch) return; this.hover = tile; this.refresh() }
  click(tile: { x: number; y: number }) {
    if (!this.on) return
    if (this.item) { if (this.h.touch) this.refresh(); else { this.hover = tile; this.refresh() } return this.drop() }
    const st = this.h.map(), hit = [...st.placements.values()].filter((p) => { const f = footprint(p); return tile.x >= f.x && tile.x < f.x + f.w && tile.y >= f.y && tile.y < f.y + f.h })
      .sort((a, b) => Number(DECOR[b.decorId].layer !== 'floor') - Number(DECOR[a.decorId].layer !== 'floor'))[0] // an object wins over the rug under it
    this.sel = hit?.id ?? null; this.reason = ''; this.draw(); this.publish()
  }
  /** Put the item in hand down at the ghost. */
  drop() {
    const g = this.anchor(); if (!this.item || !g) return
    if (!this.ok) return this.say(this.reason || 'Cannot place that here')
    if (this.moving) { const was = this.h.map().placements.get(this.moving); if (was) this.edit({ t: 'move', placementId: this.moving, x: g.x, y: g.y }, 'do', { before: was }); this.moving = null; this.item = null }
    else this.edit({ t: 'place', decorId: this.item, x: g.x, y: g.y, rotation: this.rot }, 'do', {}) // stays in hand, so several can go down quickly
    this.refresh(); this.publish()
  }
  rotate() {
    if (this.item && !this.moving) { const r = DECOR[this.item].rot; this.rot = r[(r.indexOf(this.rot) + 1) % r.length] as Rotation; this.refresh(); this.publish(); return }
    const p = this.selected(); if (!p || this.moving) return
    const r = DECOR[p.decorId].rot; if (r.length < 2) return this.say('That item only faces one way')
    this.edit({ t: 'rotate', placementId: p.id, rotation: r[(r.indexOf(p.rotation) + 1) % r.length] as Rotation }, 'do', { before: p })
  }
  act(a: 'move' | 'rotate' | 'away' | 'text', text = '') {
    const p = this.selected(); if (!p) return
    if (a === 'rotate') return this.rotate()
    if (a === 'move') { this.item = p.decorId; this.moving = p.id; this.rot = p.rotation; this.sel = null; this.refresh(); this.publish(); return }
    if (a === 'away') { this.edit({ t: 'remove', placementId: p.id }, 'do', { before: p }); this.sel = null; this.draw(); this.publish(); return }
    this.edit({ t: 'text', placementId: p.id, text }, 'do', { before: p })
  }
  undoLast() { const a = this.undo.pop(); if (a) this.run(a, 'undo'); else this.say('Nothing to undo') }
  redoLast() { const a = this.redo.pop(); if (a) this.run(a, 'redo'); else this.say('Nothing to redo') }

  // ---- the room's answers ----
  /** A patch has been applied to the map (`prev` is the map before it). If it is the answer to my oldest pending edit, record it for undo. */
  patch(ops: MapOp[], prev: MapState) {
    const head = this.pending[0]
    const hit = head && ops.length === 1 ? ops[0] : undefined
    if (head && hit && this.answers(head.edit, hit, prev)) {
      this.pending.shift()
      const after = hit.k === 'put' ? hit.p : undefined, a: Action = { before: head.action.before, after }
      if (head.silent) { /* a follow-up that restores a sign's words: not a step of its own */ }
      else if (head.kind === 'do') { this.undo.push(a); this.redo = [] }
      else {
        if (head.rekey && after) this.rekey(head.rekey, after.id, a) // a re-created item has a new id: older undo steps must follow it
        ;(head.kind === 'undo' ? this.redo : this.undo).push(a)
        if (after && head.edit.t === 'place' && head.action.before?.text) { // the restored sign gets its words back
          this.edit({ t: 'text', placementId: after.id, text: head.action.before.text }, 'redo', { before: after }, true)
        }
      }
      if (this.undo.length > STACK) this.undo.shift()
    }
    if (this.sel && !this.h.map().placements.has(this.sel)) this.sel = null // someone else took it away
    if (this.moving && !this.h.map().placements.has(this.moving)) { this.moving = null; this.item = null }
    this.refresh(); this.draw(); this.publish()
  }
  refused(reason: string) {
    this.pending.shift()
    this.say(REFUSAL_TEXT[reason as keyof typeof REFUSAL_TEXT] ?? ROOM_REFUSAL_TEXT[reason] ?? 'That did not work')
    this.refresh()
  }
  /** A fresh welcome: ids may no longer mean what they did. */
  reset() { this.pending = []; this.undo = []; this.redo = []; this.sel = null; this.moving = null; this.item = null; this.draw(); this.publish(); if (this.on) this.h.send({ t: 'build', on: true }) }

  // ---- other people ----
  remote(userId: string, on: boolean, g?: Ghost | null) {
    let o = this.others.get(userId)
    if (!on) { o?.img.destroy(); o?.label.destroy(); o?.hammer.destroy(); this.others.delete(userId); return }
    const sc = this.h.scene
    o ??= { img: sc.add.image(0, 0, 'decor').setOrigin(0, 0).setDepth(DEP.ghost).setVisible(false), label: sc.add.text(0, 0, this.h.nameOf(userId), { fontFamily: 'VT323', fontSize: '7px', color: '#14213d', backgroundColor: 'rgba(255,255,255,0.85)', padding: { x: 2, y: 0 } }).setResolution(4).setDepth(DEP.ghost + 1).setVisible(false),
      hammer: sc.add.text(0, 0, '🔨', { fontSize: '8px' }).setResolution(4).setOrigin(0.5, 1).setDepth(DEPTH.tag) }
    this.others.set(userId, o)
    if (g && DECOR[g.decorId]) {
      o.img.setVisible(true).setFrame(`${g.decorId}:${g.rotation}:0`).setPosition(g.x * TILE_PX, g.y * TILE_PX).setAlpha(0.55).setTint(g.ok ? 0xbfe9b0 : 0xf0a8a0)
      o.label.setVisible(true).setPosition(g.x * TILE_PX, g.y * TILE_PX - 7)
    } else { o.img.setVisible(false); o.label.setVisible(false) }
  }
  tick() {
    for (const [id, o] of this.others) { const a = this.h.avatar(id); if (a) o.hammer.setPosition(a.x, a.y - 34) } // a little hammer where "Decorating" is
    if (this.on && this.h.touch && this.item) { const m = this.h.mine(), k = `${m.x},${m.y},${m.facing},${this.rot}`; if (k !== this.lastFront) { this.lastFront = k; this.refresh() } } // on a phone the ghost is the tile in front of me
  }
  destroy() { for (const id of [...this.others.keys()]) this.remote(id, false); this.ghost?.destroy(); this.box?.destroy(); this.msg?.destroy() }

  /** Sound and a puff for a change anyone made (muted for me while Focusing). */
  feedback(tile: { x: number; y: number } | null) {
    if (!this.h.focusing()) tok()
    if (tile && !this.h.calm) for (let i = 0; i < 4; i++) {
      const p = this.h.scene.add.circle(tile.x * TILE_PX + 2 + Math.random() * (TILE_PX - 4), tile.y * TILE_PX + TILE_PX - 2, 1.4, 0xffffff, 0.7).setDepth(DEP.ghost)
      this.h.scene.tweens.add({ targets: p, scale: 2.2, alpha: 0, y: p.y - 4 - Math.random() * 3, x: p.x + (Math.random() * 6 - 3), duration: 420, onComplete: () => p.destroy() })
    }
  }

  // ---- inside ----
  private selected() { return this.sel ? this.h.map().placements.get(this.sel) : undefined }
  private say(text: string) { this.reason = text; this.publish() }
  private edit(edit: Edit, kind: Kind, action: Action, silent = false) {
    this.pending.push({ edit, kind, action, silent })
    this.h.send({ t: 'map.edit', base: this.h.map().version, edit })
  }
  /** Undo/redo = send the edit that turns the placement into what it was (or will be). */
  private run(a: Action, kind: 'undo' | 'redo') {
    const from = kind === 'undo' ? a.after : a.before, to = kind === 'undo' ? a.before : a.after
    let e: Edit
    if (!from && to) e = { t: 'place', decorId: to.decorId, x: to.x, y: to.y, rotation: to.rotation }
    else if (from && !to) e = { t: 'remove', placementId: from.id }
    else if (from && to && (from.x !== to.x || from.y !== to.y)) e = { t: 'move', placementId: from.id, x: to.x, y: to.y }
    else if (from && to && from.rotation !== to.rotation) e = { t: 'rotate', placementId: from.id, rotation: to.rotation }
    else if (from && to) e = { t: 'text', placementId: from.id, text: to.text ?? '' }
    else return
    this.pending.push({ edit: e, kind, action: { before: from, after: to }, rekey: e.t === 'place' ? to!.id : undefined })
    this.h.send({ t: 'map.edit', base: this.h.map().version, edit: e })
    this.publish()
  }
  private rekey(from: string, to: string, ...extra: Action[]) { for (const a of [...this.undo, ...this.redo, ...extra]) for (const p of [a.before, a.after]) if (p?.id === from) p.id = to }
  private answers(e: Edit, op: MapOp, prev: MapState): boolean {
    if (e.t === 'remove') return op.k === 'del' && op.id === e.placementId
    if (op.k !== 'put') return false
    const p = op.p
    if (e.t === 'place') return !prev.placements.has(p.id) && p.decorId === e.decorId && p.x === e.x && p.y === e.y && p.rotation === e.rotation
    if (p.id !== e.placementId) return false
    return e.t === 'move' ? p.x === e.x && p.y === e.y : e.t === 'rotate' ? p.rotation === e.rotation : (p.text ?? '') === e.text.trim().slice(0, 40)
  }

  /** Where the item in hand would go: under the pointer (its middle on the pointer), or on a phone in front of me. */
  private anchor() {
    if (!this.item) return null
    const d = DECOR[this.item], swap = this.rot === 90 || this.rot === 270, w = swap ? d.h : d.w, h = swap ? d.w : d.h
    if (this.h.touch) {
      const m = this.h.mine(), [dx, dy] = FRONT[m.facing]
      return { x: dx === 0 ? m.x - Math.floor((w - 1) / 2) : dx > 0 ? m.x + 1 : m.x - w, y: dy === 0 ? m.y - Math.floor((h - 1) / 2) : dy > 0 ? m.y + 1 : m.y - h }
    }
    return this.hover ? { x: this.hover.x - Math.floor((w - 1) / 2), y: this.hover.y - Math.floor((h - 1) / 2) } : null
  }
  private refresh() {
    const g = this.anchor(), st = this.h.map()
    if (!this.on || !this.item || !g) { this.ok = false; this.draw(); this.tell(null); return }
    const edit: Edit = this.moving ? { t: 'move', placementId: this.moving, x: g.x, y: g.y } : { t: 'place', decorId: this.item, x: g.x, y: g.y, rotation: this.rot }
    const r = checkEdit(st, edit, { id: this.h.me, canBuild: true }, st.version, { occupied: this.h.occupied() })
    this.ok = r.ok; this.reason = r.ok ? '' : REFUSAL_TEXT[r.reason]
    this.draw(); this.tell({ decorId: this.item, x: g.x, y: g.y, rotation: this.rot, ok: this.ok }); this.publish()
  }
  private tell(g: Ghost | null) { // friends see my ghost; only when it changed
    if (!this.on) return
    const k = g ? `${g.decorId}${g.x},${g.y},${g.rotation},${g.ok}` : ''
    if (k !== this.sent) { this.sent = k; this.h.send({ t: 'build', on: true, g }) }
  }
  private draw() {
    const sc = this.h.scene, g = this.on && this.item ? this.anchor() : null
    if (g && this.item) {
      this.ghost ??= sc.add.image(0, 0, 'decor').setOrigin(0, 0).setDepth(DEP.ghost)
      this.ghost.setVisible(true).setFrame(`${this.item}:${this.rot}:0`).setPosition(g.x * TILE_PX, g.y * TILE_PX).setAlpha(0.75).setTint(this.ok ? 0x9fe28f : 0xf08a80)
      this.msg ??= sc.add.text(0, 0, '', { fontFamily: 'VT323', fontSize: '7px', color: '#ffffff', backgroundColor: 'rgba(160,50,40,0.9)', padding: { x: 2, y: 0 } }).setResolution(4).setDepth(DEP.ghost + 1)
      this.msg.setVisible(!this.ok && !!this.reason).setText(this.reason).setPosition(g.x * TILE_PX, g.y * TILE_PX - 8)
    } else { this.ghost?.setVisible(false); this.msg?.setVisible(false) }
    this.box ??= sc.add.graphics().setDepth(DEP.tag)
    this.box.clear()
    const p = this.on ? this.selected() : undefined
    if (p) { const f = footprint(p); this.box.lineStyle(1, 0xf2c14e, 1).strokeRect(f.x * TILE_PX - 0.5, f.y * TILE_PX - 0.5, f.w * TILE_PX + 1, f.h * TILE_PX + 1) }
  }
  private publish() {
    const p = this.selected()
    this.h.publish({ on: this.on, item: this.item, moving: !!this.moving, sel: p ? { id: p.id, decorId: p.decorId, text: p.text ?? '' } : null, ok: this.ok, reason: this.reason, undo: this.undo.length, redo: this.redo.length })
  }
}

/** A soft wooden "tok", if the player turned cosy sounds on. */
function tok() {
  try {
    const p = JSON.parse(localStorage.getItem('village.sound') ?? '{}'); if (!p.on) return
    const ac = new AudioContext(), o = ac.createOscillator(), g = ac.createGain(), vol = (p.volume ?? 0.5) * (p.effects ?? 1)
    o.type = 'triangle'; o.frequency.setValueAtTime(260, ac.currentTime); o.frequency.exponentialRampToValueAtTime(110, ac.currentTime + 0.07)
    g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.2 * vol + 0.0001, ac.currentTime + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.11)
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.12); o.onended = () => ac.close()
  } catch { /* no audio available */ }
}
