// One stroke weight for the whole set (24px grid, 1.8 stroke).
const paths = {
  Goals: 'M12 3l9 17H3L12 3zM12 10v4',
  Deadlines: 'M12 21a8 8 0 100-16 8 8 0 000 16zM12 8v4l3 2',
  Tasks: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  'Do now': 'M13 3L5 14h6l-1 7 8-11h-6l1-7z',
  Calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  Coach: 'M4 5h16v11H9l-5 4V5z',
}
export const Icon = ({ name }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
)
