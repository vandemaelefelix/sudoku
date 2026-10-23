import { createScene, type Scene, stepScene } from '@/scan/effects/scene'
import type { Quad, ViewSize } from '@/utils/geometry.utils'

export const VIEW: ViewSize = { width: 402, height: 874 }

export const GRID: Quad = [
  { x: 50, y: 300 },
  { x: 350, y: 300 },
  { x: 350, y: 600 },
  { x: 50, y: 600 },
]

/** A scene one second after the grid was found, so presence is 1. */
export function foundScene(): Scene {
  const scene = createScene(VIEW)
  for (let t = 0; t <= 1; t += 1 / 60) stepScene(scene, GRID, t, false)
  return scene
}

/** A canvas that records every draw call that an effect makes. */
export function fakeCanvas() {
  return { drawRect: jest.fn(), drawPath: jest.fn(), drawAtlas: jest.fn() }
}
