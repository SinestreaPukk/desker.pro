// The word lists for the filter (SPEC §12): one place to edit. English entries are whole words (the filter adds -s, -ed, -ing and catches simple evasion);
// Thai entries match anywhere in the text (Thai has no spaces). Conservative on purpose: words that are also ordinary words are left out.
// Thai entries need a native-speaker review before launch (docs/village/th-review.md).
export const EN = [
  'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'shitty', 'bullshit', 'bitch', 'asshole', 'dumbass', 'dick', 'cunt', 'bastard', 'slut', 'whore',
  'wanker', 'twat', 'nigger', 'nigga', 'faggot', 'retard',
]
export const TH = [
  'ควย', 'เหี้ย', 'สัส', 'ไอ้สัตว์', 'อีสัตว์', 'แม่ง', 'เย็ด', 'ส้นตีน', 'อีดอก', 'ไอ้ห่า', 'อีห่า', 'หน้าหี', 'ตอแหล',
  'เชี่ย', 'ชิบหาย', 'ระยำ', 'อีควาย', 'ไอ้ควาย', 'ไอ้เหี้ย', 'อีเหี้ย',
]
