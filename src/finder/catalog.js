// The goal finder's questions and choices, with no AI. The choices word the goals and vision; they never change the ranking. Pure.
import { rankedGoals } from '../goals.js'

export const MAX_GOALS = 5
export const MAX_AREAS = 3
export const AREAS = [
  { name: 'Studies', choices: ['Get top grades', 'Pass everything comfortably', 'Get into a program I want', 'Master a subject'] },
  { name: 'Career', choices: ['Get a job or internship', 'Get promoted', 'Change careers', 'Get better at my work'] },
  { name: 'Building something', choices: ['Launch a product', 'First customers', 'Make it pay', 'Creative work'] },
  { name: 'Money', choices: ['Save more', 'Clear my debt', 'Start investing', 'Earn more'] },
  { name: 'Health', choices: ['Get fit', 'Sleep and eat better', 'Reach a healthy weight', 'Feel less stressed'] },
  { name: 'Relationships & family', choices: ['More time with family', 'Closer friends', 'A stronger relationship', 'Support my parents'] },
  { name: 'Personal growth', choices: ['Learn a new skill', 'Read more', 'Build a daily habit', 'Feel more confident'] },
  { name: 'Fun', choices: ['Make time for a hobby', 'Travel somewhere new', 'Try something new', 'Join a club or group'] },
]
export const VISION_WORDS = ['Freedom', 'Security', 'Mastery', 'Impact', 'Connection', 'Adventure']

export const stepsFor = (areas) => [{ kind: 'areas' }, ...areas.slice(0, MAX_AREAS).map((area) => ({ kind: 'about', area })), { kind: 'vision' }]
export const canAddGoal = (goals) => rankedGoals(goals).length < MAX_GOALS

const lowerFirst = (s) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s)
export function visionSentence(word, titles) {
  if (!word) return ''
  return titles.length ? `${word}: ${titles.map(lowerFirst).join(', ')}.` : `${word}.`
}

// Adds new goals after the existing ones. The limit only stops new goals, and `left` is what did not fit.
export function mergeGoals(existing, fresh) {
  const named = fresh.map((g) => ({ ...g, title: (g.title || '').trim(), level: 3 })).filter((g) => g.title)
  const room = Math.max(0, MAX_GOALS - existing.length)
  return { goals: [...existing, ...named.slice(0, room)], left: named.slice(room) }
}
