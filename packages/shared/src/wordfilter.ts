// A small Thai + English filter (SPEC §6.3): bad words become ★. It is a speed bump for a student study space, not a moderation system (reports and bans come in Phase 1).
// English matches whole words and a few simple endings; Thai has no spaces, so Thai terms match anywhere in the text.
const EN = ['fuck', 'fucking', 'fucker', 'shit', 'shitty', 'bitch', 'asshole', 'dick', 'cunt', 'bastard', 'slut', 'whore', 'nigger', 'nigga', 'faggot', 'retard']
const TH = ['ควย', 'เหี้ย', 'สัส', 'ไอ้สัตว์', 'อีสัตว์', 'แม่ง', 'เย็ด', 'ส้นตีน', 'อีดอก', 'ไอ้ห่า', 'อีห่า', 'หน้าหี', 'ตอแหล']
const stars = (n: number) => '★'.repeat(n)
const enRe = new RegExp(`(?<![\\p{L}\\p{N}])(?:${EN.join('|')})(?:s|ed|ing)?(?![\\p{L}\\p{N}])`, 'giu')
const thRe = new RegExp(TH.join('|'), 'gu')
export const maskBadWords = (text: string) => text.replace(enRe, (m) => stars(m.length)).replace(thRe, (m) => stars([...m].length))
