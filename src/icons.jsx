// Nav icons: outline only, 24px grid, 1.5 stroke, drawn at 20px.
const icons = {
  Today: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4M12 16a4 4 0 100-8 4 4 0 000 8z',
  Goals: 'M6 21V4M6 5h11l-2.500 4 2.500 4H6',
  Projects: 'M3 7h7l2 2h9v10H3zM3 7V5h7l2 2',
  Deadlines: 'M7 3h10M7 21h10M8 3v3l4 4 4-4V3M8 21v-3l4-4 4 4v3',
  Tasks: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  Calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15h.01M15 15h.01',
  Agent: 'M4 5h16v11H9l-5 4zM9 10h.01M15 10h.01M10 13c1 .8 3 .8 4 0',
  Settings: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6',
}
export const Icon = ({ name }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={icons[name]} />
  </svg>
)
