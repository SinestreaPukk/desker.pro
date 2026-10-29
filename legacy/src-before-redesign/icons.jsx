// Tab icons: outline only, 24px grid, 1.5 stroke, drawn at 20px.
const icons = {
  Goals: { fill: 'M6 5h11l-2.500 4 2.500 4H6z', line: 'M6 21V4M6 5h11l-2.500 4 2.500 4H6' },
  Deadlines: { fill: 'M8 3h8v3l-4 4-4-4zM8 21h8v-3l-4-4-4 4z', line: 'M7 3h10M7 21h10M8 3v3l4 4 4-4V3M8 21v-3l4-4 4 4v3' },
  Tasks: { fill: 'M4 4h7v7H4z', line: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  'Do now': { fill: 'M10 8l6 4-6 4z', line: 'M12 21a9 9 0 100-18 9 9 0 000 18zM10 8l6 4-6 4z' },
  Calendar: { fill: 'M4 6h16v4H4z', line: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15h.01M15 15h.01' },
  Coach: { fill: 'M4 5h16v11H9l-5 4z', line: 'M4 5h16v11H9l-5 4zM9 10h.01M15 10h.01M10 13c1 .8 3 .8 4 0' },
}
export const Icon = ({ name }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={icons[name].line} />
  </svg>
)
