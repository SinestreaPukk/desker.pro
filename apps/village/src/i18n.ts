// Tiny translations: t('key'). English is the source; a missing Thai string shows English. Bubbles, the Board and questions are what people wrote and are never translated.
import { useSyncExternalStore } from 'react'

export type Lang = 'en' | 'th'
export const EN = {
  'hint.keys': 'WASD to walk · T to talk · X to sit · ? for help',
  'hint.touch': 'Drag to walk · tap a seat to sit · tap a person for actions',
  'hud.help': 'Help', 'hud.settings': 'Settings', 'hud.close': 'Close (Esc)', 'hud.keys': 'Keys',
  'bar.talk': 'Talk', 'bar.ask': 'Ask', 'bar.sit': 'Sit', 'bar.focus': 'Focus', 'bar.board': 'Board', 'bar.more': 'More', 'bar.members': 'Members', 'bar.chatlog': 'Chat log', 'bar.emote': 'Emote', 'bar.map': 'Map',
  'set.sound': 'Sound', 'set.sound.on': 'Cosy sounds', 'set.sound.master': 'Master', 'set.sound.effects': 'Effects', 'set.sound.ambience': 'Ambience',
  'set.controls': 'Controls', 'set.controls.reset': 'Reset keys', 'set.controls.press': 'Press a key…', 'set.controls.reserved': 'That key can’t be used.', 'set.controls.taken': 'Already used for',
  'set.a11y': 'Accessibility', 'set.a11y.motion': 'Reduced motion (no snow, steam, puffs; the camera doesn’t glide)', 'set.a11y.big': 'Larger bubble text', 'set.a11y.contrast': 'High-contrast name tags', 'set.a11y.cb': 'Colour-blind safe urgency (adds icons)',
  'set.lang': 'Language', 'set.next': 'Takes effect the next time you open the village.',
  'tour.1': 'Walk with WASD (or drag, or tap a spot).', 'tour.2': 'Your desk is in the Library. Press X to sit.', 'tour.2t': 'Your desk is in the Library. Tap Sit to sit.', 'tour.3': 'Press F to start studying. Friends will see you focusing.', 'tour.3t': 'Tap Focus to start studying. Friends will see you focusing.',
  'tour.next': 'Next', 'tour.done': 'Got it', 'tour.skip': 'Skip', 'tour.who': 'Kodama',
} as const
export type Key = keyof typeof EN
export const TH: Partial<Record<Key, string>> = {
  'hint.keys': 'WASD เพื่อเดิน · T เพื่อพูด · X เพื่อนั่ง · ? ดูวิธีใช้', 'hint.touch': 'ลากเพื่อเดิน · แตะที่นั่งเพื่อนั่ง · แตะที่คนเพื่อดูตัวเลือก',
  'hud.help': 'ช่วยเหลือ', 'hud.settings': 'ตั้งค่า', 'hud.close': 'ปิด (Esc)', 'hud.keys': 'ปุ่มลัด',
  'bar.talk': 'พูด', 'bar.ask': 'ถาม', 'bar.sit': 'นั่ง', 'bar.focus': 'โฟกัส', 'bar.board': 'บอร์ด', 'bar.more': 'เพิ่มเติม', 'bar.members': 'สมาชิก', 'bar.chatlog': 'ประวัติแชท', 'bar.emote': 'อีโมจิ', 'bar.map': 'แผนที่',
  'set.sound': 'เสียง', 'set.sound.on': 'เสียงบรรยากาศอบอุ่น', 'set.sound.master': 'ระดับเสียงรวม', 'set.sound.effects': 'เสียงเอฟเฟกต์', 'set.sound.ambience': 'เสียงบรรยากาศ',
  'set.controls': 'การควบคุม', 'set.controls.reset': 'รีเซ็ตปุ่ม', 'set.controls.press': 'กดปุ่มที่ต้องการ…', 'set.controls.reserved': 'ใช้ปุ่มนี้ไม่ได้', 'set.controls.taken': 'ปุ่มนี้ถูกใช้แล้วสำหรับ',
  'set.a11y': 'การเข้าถึง', 'set.a11y.motion': 'ลดการเคลื่อนไหว (ไม่มีหิมะ ไอน้ำ ฝุ่น และกล้องไม่เลื่อนช้า)', 'set.a11y.big': 'ข้อความในบับเบิลใหญ่ขึ้น', 'set.a11y.contrast': 'ป้ายชื่อคอนทราสต์สูง', 'set.a11y.cb': 'สีแจ้งเตือนสำหรับผู้ตาบอดสี (เพิ่มไอคอน)',
  'set.lang': 'ภาษา', 'set.next': 'จะมีผลเมื่อเปิดหมู่บ้านครั้งถัดไป',
  'tour.1': 'เดินด้วย WASD (หรือลาก หรือแตะที่จุดหมาย)', 'tour.2': 'โต๊ะของคุณอยู่ในห้องสมุด กด X เพื่อนั่ง', 'tour.2t': 'โต๊ะของคุณอยู่ในห้องสมุด แตะ "นั่ง" เพื่อนั่ง', 'tour.3': 'กด F เพื่อเริ่มอ่านหนังสือ เพื่อนจะเห็นว่าคุณกำลังโฟกัส', 'tour.3t': 'แตะ "โฟกัส" เพื่อเริ่มอ่านหนังสือ เพื่อนจะเห็นว่าคุณกำลังโฟกัส',
  'tour.next': 'ถัดไป', 'tour.done': 'เข้าใจแล้ว', 'tour.skip': 'ข้าม', 'tour.who': 'โคดามะ',
}
let lang: Lang = (localStorage.getItem('village.lang') as Lang) || (navigator.language.startsWith('th') ? 'th' : 'en')
export const getLang = () => lang
export const setLang = (l: Lang) => { lang = l; localStorage.setItem('village.lang', l); document.documentElement.lang = l; subs.forEach((f) => f()) }
const subs = new Set<() => void>()
document.documentElement.lang = lang
export const t = (k: Key): string => (lang === 'th' && TH[k]) || EN[k]
/** Re-render a component when the language changes. */
export const useLang = () => useSyncExternalStore((f) => { subs.add(f); return () => void subs.delete(f) }, getLang)
