import Phaser from 'phaser'
import { WorldScene, type SceneData } from './WorldScene.ts'

/** Starts the Phaser game inside `parent`. Pixel-perfect, resizes with the window, pauses itself when the tab is hidden. */
export function startGame(parent: HTMLElement, data: SceneData): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, backgroundColor: '#dfe9f5', pixelArt: true, roundPixels: true, antialias: false,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    scene: [], disableContextMenu: true,
  })
  game.scene.add('world', WorldScene, true, data)
  if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game // for poking at the scene from the browser console
  return game
}
