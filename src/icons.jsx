// 16x16 pixel icons drawn at 2x (32px). Same API as before: <Icon name="Today" />. Decorative: labels live on the buttons.
const FILE = { Today: 'today', Goals: 'goals', Projects: 'projects', Tasks: 'tasks', Calendar: 'calendar', Agent: 'coach', Settings: 'settings', Add: 'add', Check: 'check', Clock: 'clock', Flag: 'flag', Close: 'close', Send: 'send', More: 'more', Grip: 'grip' }
export const Icon = ({ name }) => <img src={`/pixel/i-${FILE[name]}.png`} alt="" aria-hidden="true" width="32" height="32" className="px-art block h-8 w-8 shrink-0" />
