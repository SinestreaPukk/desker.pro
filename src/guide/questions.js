// Questionnaire content and the pure helpers around it (no React, so node can test them).
export const AREAS = ['Education', 'Career / Work', 'Finance', 'Health & Fitness', 'Relationships', 'Family', 'Personal Growth', 'Hobbies & Fun']
export const PHASES = ['Areas', 'Values', 'Reality', 'Future', 'Priorities', 'Action', 'Review']

// Starter phrases per life area, so the per-area screen has ideas to tap instead of a blank box.
const IDEAS = {
  'Education': ['I have finished ', 'I speak ', 'I understand ', 'I have a degree or certificate in '],
  'Career / Work': ['I work as ', 'I run my own ', 'I earn recognition for ', 'I have a job where I can '],
  'Finance': ['I have savings of ', 'I am debt-free ', 'My money works for me through ', 'I own '],
  'Health & Fitness': ['I exercise ', 'I can run or lift ', 'I sleep and eat ', 'I feel energetic and '],
  'Relationships': ['I have close friends who ', 'I am in a relationship where ', 'I spend regular time with ', 'I feel connected to '],
  'Family': ['I spend time with my family by ', 'I support my parents with ', 'My home is ', 'We share traditions like '],
  'Personal Growth': ['I am calmer and ', 'I read or learn ', 'I have the habit of ', 'I am confident when '],
  'Hobbies & Fun': ['I play or make ', 'I travel to ', 'I spend free time ', 'I belong to a group for '],
}

const T = (id, phase, q, hint, chips, extra = {}) => ({ id, phase, kind: 'text', q, hint, chips, ...extra })

// The steps for the chosen areas, in order. Step 0 (the areas picker) is always first.
export function stepsFor(areas) {
  return [
    { id: 'areas', phase: 0, kind: 'areas', q: 'Which parts of life do you want goals for?', hint: 'Pick at least one. You can add your own.' },
    T('q1', 1, 'What matters most to you?', 'Pick a few words, like freedom, health, family, security.', ['Freedom and ', 'Health and ', 'Family and ', 'Security and ', 'Learning and ']),
    T('q2', 1, "Whose idea of success are you chasing, yours or someone else's?", "Be honest. Name the person if it isn't you.", ['Mostly mine', 'My parents', 'What others expect of me', 'Society']),
    T('q3', 1, 'When do you feel most like yourself?', 'A moment, place or activity that energizes you.', ['When I am outdoors', 'When I am creating something', 'When I am with ', 'When I am learning']),
    { id: 'q4', phase: 2, kind: 'rate', q: 'Rate each area right now', hint: '1 = needs a lot of work, 10 = thriving.' },
    T('q5', 2, "What's working well that you want to keep?", 'Small wins count.', ['My routine of ', 'My friendship with ', 'I am proud that I ', 'My health is ']),
    T('q6', 2, 'What have you complained about most this past year?', 'Repeated frustrations point to real goals.', ['I never have time for ', 'I am tired of ', 'I keep putting off ', 'I wish I had more ']),
    ...areas.map((area) => T(`q7:${area}`, 3, 'In 5 years, what does great look like here?', 'Ignore money, time and fear for now.', IDEAS[area] || ['I wake up and ', 'I have ', 'I am able to ', 'I no longer worry about '], { area })),
    T('q8', 3, 'What bold goal have you secretly wanted?', 'In any area. The one that feels a bit scary to say out loud.', ['I want to start ', 'I want to become ', 'I want to move to ', 'I want to build ']),
    T('q9', 3, 'What would you regret never doing?', 'Skills, adventures, creative projects.', ['Learning to ', 'Visiting ', 'Making my own ', 'Starting a ']),
    { id: 'q10', phase: 4, kind: 'triple', q: 'If you could only achieve 3 things this year, what would they be?', hint: 'Short and concrete is best.' },
    { id: 'q11', phase: 4, kind: 'tag', q: 'Which of these excite you, and which feel like obligations?', hint: 'Tap each one to mark it. Skip any you are unsure about.' },
    T('q12', 4, 'What will you stop doing to make room?', 'A habit, commitment or time sink.', ['Scrolling ', 'Saying yes to ', 'Spending time on ']),
    T('q13', 5, "What's the smallest next step on your top goal? Something you can do in 24 hours.", 'Make it tiny: "Email X", "Open a savings account".', ['Email ', 'Open ', 'Book a time to ']),
    T('q14', 5, 'What might get in your way, and how will you handle it?', 'One obstacle, one plan.', ['I might run out of ', 'If I get busy, I will ', 'When I feel stuck, I will ']),
    T('q15', 5, 'Who can keep you accountable?', 'A friend, mentor or study partner.', ['My friend ', 'My mentor ', 'A study partner']),
  ]
}

export const QUESTION_MIN = 0.5 // minutes per screen, for the time estimate
export const minutesLeft = (steps, i) => Math.max(1, Math.round((steps.length - i) * QUESTION_MIN))

const trim = (s) => (typeof s === 'string' ? s.trim() : '')
export const chipLabel = (s) => (s.length > 60 ? `${s.slice(0, 57)}…` : s)

// Own answers offered in Q11 (from Q7-Q9 and the Q10 "top 3"), deduplicated.
export function tagItems(answers, areas) {
  const items = [...(answers.q10 || []), answers.q8, ...areas.map((a) => answers[`q7:${a}`]), answers.q9].map(trim).filter(Boolean)
  return [...new Set(items)].slice(0, 14)
}

// Everything the user answered, as readable question/answer pairs for the AI.
export function qaOf(steps, answers, areas) {
  const out = []
  for (const s of steps) {
    const phase = PHASES[s.phase]
    const v = answers[s.id]
    let a = ''
    if (s.kind === 'text') a = trim(v)
    else if (s.kind === 'rate') a = areas.filter((x) => v?.[x]).map((x) => `${x}: ${v[x]}/10`).join('; ')
    else if (s.kind === 'triple') a = (v || []).map(trim).filter(Boolean).map((x, i) => `${i + 1}. ${x}`).join('\n')
    else if (s.kind === 'tag') {
      const by = (m) => Object.entries(v || {}).filter(([, t]) => t === m).map(([k]) => k).join('; ')
      a = [by('x') && `Excited: ${by('x')}`, by('o') && `Obligation: ${by('o')}`].filter(Boolean).join('\n')
    }
    if (a) out.push({ phase, q: s.kind === 'triple' ? 'Top 3 things to achieve this year' : s.q, area: s.area, a })
  }
  return out
}

const LEVEL = { long: 1, mid: 2, short: 3 }
// AI answer -> the app's goal shape, plus the editable review state.
export function fromAI(out, now = Date.now()) {
  return {
    vision: out.vision || '',
    summary: out.summary || '',
    letGo: out.letGo || [],
    goals: out.goals.map((g, i) => ({
      id: now + i, title: g.title, level: LEVEL[g.level], happiness: g.isHappiness, ...(g.area && { area: g.area }), ...(g.top && { top: true }),
      ...(g.why && { why: g.why }), ...(g.firstStep && { firstStep: g.firstStep }), ...(g.obstacle && { obstacle: g.obstacle }), ...(g.plan && { plan: g.plan }),
    })),
  }
}

// Goals to add to the pyramid when the user saves: the vision (level 0) first, then the reviewed goals.
export function toSave(result, now = Date.now()) {
  const vision = result.vision.trim() ? [{ id: now - 1, title: result.vision.trim(), level: 0, happiness: false }] : []
  return [...vision, ...result.goals.filter((g) => g.title.trim()).map((g, i) => ({ ...g, id: now + i, title: g.title.trim() }))]
}

// Soft tag colours; custom areas get a stable one from their name.
const TAGS = ['bg-[#dbe7fb] text-[#274677]', 'bg-[#dff1e3] text-[#245a2a]', 'bg-[#fbe9cf] text-[#7a4c0e]', 'bg-[#f5dce6] text-[#7a2a4d]', 'bg-[#e6dcf5] text-[#4a2a7a]', 'bg-[#d6f0ef] text-[#1f5a58]']
export const areaTag = (a) => TAGS[[...a].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TAGS.length]
