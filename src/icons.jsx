import { useTheme } from './theme.js'
// 16x16 pixel icons drawn at 2x (32px). Same API as before: <Icon name="Today" />. Decorative: labels live on the buttons.
const FILE = { Today: 'today', Goals: 'goals', Projects: 'projects', Tasks: 'tasks', Calendar: 'calendar', Agent: 'coach', Settings: 'settings', Add: 'add', Check: 'check', Clock: 'clock', Rhythm: 'clock', Flag: 'flag', Close: 'close', Send: 'send', More: 'more', Grip: 'grip', Undo: 'undo' }
export const Icon = ({ name, small }) => <img src={`/pixel/${useTheme() === 'dark' ? 'dark/' : ''}i-${FILE[name]}.png`} alt="" aria-hidden="true" width={small ? 16 : 32} height={small ? 16 : 32} className={`px-art block shrink-0 ${small ? 'h-4 w-4' : 'h-8 w-8'}`} />
