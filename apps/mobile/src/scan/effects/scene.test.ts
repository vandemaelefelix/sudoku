import type { Quad } from '../../scanner'
import { createScene, LOCK_DWELL, MAX_STEP, PRESENCE_TIME, type Scene, stepScene } from './scene'

const VIEW = { width: 402, height: 874 }

function gridAt(x: number, y: number, size = 300): Quad {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ]
}

/** A new quad object with the same corners, as the camera gives one per detection. */
function detection(quad: Quad | null): Quad | null {
  if (quad == null) return null
  return [{ ...quad[0] }, { ...quad[1] }, { ...quad[2] }, { ...quad[3] }]
}

/** Steps the scene at 60 fps from t0 to t1 with the same corners, one detection per frame. */
function run(scene: Scene, quad: Quad | null, t0: number, t1: number) {
  for (let t = t0; t <= t1 + 1e-9; t += 1 / 60) stepScene(scene, detection(quad), t, false)
  return scene
}

describe('stepScene', () => {
  it('reports found on the first usable quad', () => {
    const scene = run(createScene(VIEW), null, 0, 1)
    stepScene(scene, gridAt(50, 300), 1.5, false)
    expect(scene.event).toBe('found')
    expect(scene.foundAt).toBe(1.5)
    expect(scene.m).not.toBeNull()
    expect(scene.inverse).not.toBeNull()
  })

  it('reports found only once while the grid stays', () => {
    const scene = run(createScene(VIEW), gridAt(50, 300), 0, 1)
    expect(scene.event).toBe('none')
    expect(scene.foundAt).toBe(0)
  })

  it('reports lost when the grid goes, and keeps the last grid', () => {
    const grid = gridAt(50, 300)
    const scene = run(createScene(VIEW), grid, 0, 0.5)
    stepScene(scene, null, 1.5, false)
    expect(scene.event).toBe('lost')
    expect(scene.lostAt).toBe(1.5)
    expect(scene.quad).toBeNull()
    expect(scene.m).toBeNull()
    expect(scene.inverse).toBeNull()
    expect(scene.lastQuad).toEqual(grid)
  })

  it('reports a jump to another grid as found, with the loss in the same frame', () => {
    const scene = run(createScene(VIEW), gridAt(50, 100, 200), 0, 0.5)
    stepScene(scene, gridAt(50, 550, 200), 1.5, false)
    expect(scene.event).toBe('found')
    expect(scene.foundAt).toBe(1.5)
    expect(scene.lostAt).toBe(1.5)
  })

  it('does not count a small step as a jump', () => {
    const scene = run(createScene(VIEW), gridAt(50, 100, 200), 0, 1)
    stepScene(scene, gridAt(50, 150, 200), 1.5, false)
    expect(scene.event).toBe('none')
    expect(scene.foundAt).toBe(0)
  })

  it('treats a quad with three corners on one line as no grid', () => {
    const flat: Quad = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 0, y: 100 },
    ]
    const scene = run(createScene(VIEW), flat, 0, 1)
    expect(scene.quad).toBeNull()
    expect(scene.m).toBeNull()
    expect(scene.event).toBe('none')
    expect(scene.presence).toBe(0)
  })

  it('moves the presence to 1 in 0.4 s while a grid is found, and back after a loss', () => {
    const scene = run(createScene(VIEW), null, 0, 1)
    run(scene, gridAt(50, 300), 1, 1 + PRESENCE_TIME / 2)
    expect(scene.presence).toBeGreaterThan(0.4)
    expect(scene.presence).toBeLessThan(0.6)
    run(scene, gridAt(50, 300), 1 + PRESENCE_TIME / 2 + 1 / 60, 1.5)
    expect(scene.presence).toBe(1)
    run(scene, null, 1.5 + 1 / 60, 3)
    expect(scene.presence).toBe(0)
  })

  it('takes no step on the first frame', () => {
    const scene = createScene(VIEW)
    stepScene(scene, null, 5, false)
    expect(scene.dt).toBe(0)
    expect(scene.t).toBe(5)
  })

  it('clamps a long pause to 0.1 s', () => {
    const scene = run(createScene(VIEW), null, 0, 1)
    stepScene(scene, gridAt(50, 300), 1, false)
    stepScene(scene, gridAt(50, 300), 30, false)
    expect(scene.dt).toBe(MAX_STEP)
    expect(scene.presence).toBeLessThan(1)
  })

  it('keeps the motion while the grid moves at 60 pt/s and is seen every 4th frame', () => {
    const scene = run(createScene(VIEW), null, 0, 1)
    let quad: Quad | null = null
    let i = 0
    for (let t = 1; t < 3; t += 1 / 60, i++) {
      if (i % 4 === 0) quad = gridAt(50 + 60 * (t - 1), 300)
      stepScene(scene, quad, t, false)
    }
    expect(scene.motion).toBeGreaterThan(0.9)
    expect(scene.steady).toBe(false)
  })

  it('drives the motion to 0 when a still grid is seen again and again', () => {
    const scene = run(createScene(VIEW), null, 0, 1)
    let quad: Quad | null = null
    let i = 0
    for (let t = 1; t < 3; t += 1 / 60, i++) {
      if (i % 4 === 0) quad = gridAt(50, 300)
      stepScene(scene, quad, t, false)
    }
    expect(scene.motion).toBeLessThan(0.1)
  })

  it('becomes steady when the corners hold still, and records the time', () => {
    const scene = run(createScene(VIEW), null, 0, 1)
    run(scene, gridAt(50, 300), 1, 1.5)
    expect(scene.steady).toBe(true)
    expect(scene.steadyAt).toBeGreaterThan(1)
    expect(scene.steadyAt).toBeLessThan(2)
    stepScene(scene, null, 1.5 + 1 / 60, false)
    expect(scene.steady).toBe(false)
  })

  it('passes Reduce Motion to the effects', () => {
    const scene = createScene(VIEW)
    stepScene(scene, null, 0, true)
    expect(scene.reduceMotion).toBe(true)
  })
})

describe('lock-on', () => {
  const FRAME = 1 / 60

  it('grows the progress from the time the scene becomes steady', () => {
    const scene = run(createScene(VIEW), gridAt(50, 300), 0, 0.5)
    expect(scene.steady).toBe(true)
    expect(scene.lockProgress).toBeCloseTo((scene.t - scene.steadyAt) / LOCK_DWELL, 6)
    expect(scene.lockProgress).toBeGreaterThan(0)
    expect(scene.lockedAt).toBe(-1)
  })

  it('locks on LOCK_DWELL after the scene becomes steady', () => {
    const scene = run(createScene(VIEW), gridAt(50, 300), 0, 2)
    expect(scene.lockProgress).toBe(1)
    expect(Math.abs(scene.lockedAt - (scene.steadyAt + LOCK_DWELL))).toBeLessThanOrEqual(FRAME)
  })

  it('resets the progress when the grid is lost', () => {
    const scene = run(createScene(VIEW), gridAt(50, 300), 0, 0.5)
    stepScene(scene, null, 0.5 + FRAME, false)
    expect(scene.lockProgress).toBe(0)
  })

  it('restarts the progress when the grid jumps to another grid', () => {
    const scene = run(createScene(VIEW), gridAt(50, 100, 200), 0, 0.5)
    stepScene(scene, gridAt(50, 550, 200), 0.5 + FRAME, false)
    expect(scene.lockProgress).toBe(0)
  })

  it('keeps the locked quad and ignores new detections after lock-on', () => {
    const locked = gridAt(50, 300)
    const scene = run(createScene(VIEW), locked, 0, 2)
    const lockedAt = scene.lockedAt
    stepScene(scene, gridAt(50, 100, 200), 2 + FRAME, false)
    stepScene(scene, null, 2 + 2 * FRAME, false)
    expect(scene.quad).toEqual(locked)
    expect(scene.event).toBe('none')
    expect(scene.lockedAt).toBe(lockedAt)
    expect(scene.lockProgress).toBe(1)
  })

  it('starts unlocked', () => {
    const scene = createScene(VIEW)
    expect(scene.lockProgress).toBe(0)
    expect(scene.lockedAt).toBe(-1)
  })
})
