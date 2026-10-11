import { createScene, type Scene, stepScene } from './scene'
import type { Quad } from '@/utils/geometry.utils'
import {
  GRID_WIDTH_HYSTERESIS,
  LOCK_DWELL,
  MAX_STEP,
  MIN_GRID_WIDTH,
  PRESENCE_TIME,
  REARM_LOST,
  WARMUP,
} from './scene.constants'

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
  // The grid comes into view after the warm-up, so the dwell counts from steadyAt.
  const AFTER = WARMUP + 0.5

  /** A scene that sees no grid until AFTER. */
  function warm(armed = true) {
    return run(createScene(VIEW, armed), null, 0, AFTER - FRAME)
  }

  it('grows the progress from the time the scene becomes steady', () => {
    const scene = run(warm(), gridAt(50, 300), AFTER, AFTER + 0.5)
    expect(scene.steady).toBe(true)
    expect(scene.steadyAt).toBeGreaterThan(AFTER)
    expect(scene.lockProgress).toBeCloseTo((scene.t - scene.steadyAt) / LOCK_DWELL, 6)
    expect(scene.lockProgress).toBeGreaterThan(0)
    expect(scene.lockedAt).toBe(-1)
  })

  it('locks on LOCK_DWELL after the scene becomes steady', () => {
    const scene = run(warm(), gridAt(50, 300), AFTER, AFTER + 3)
    expect(scene.lockProgress).toBe(1)
    expect(Math.abs(scene.lockedAt - (scene.steadyAt + LOCK_DWELL))).toBeLessThanOrEqual(FRAME)
  })

  it('resets the progress when the grid is lost', () => {
    const scene = run(warm(), gridAt(50, 300), AFTER, AFTER + 0.5)
    expect(scene.lockProgress).toBeGreaterThan(0)
    stepScene(scene, null, AFTER + 0.5 + FRAME, false)
    expect(scene.lockProgress).toBe(0)
  })

  it('restarts the progress when the grid jumps to another grid', () => {
    const scene = run(warm(), gridAt(50, 100, 200), AFTER, AFTER + 0.5)
    expect(scene.lockProgress).toBeGreaterThan(0)
    stepScene(scene, gridAt(50, 550, 200), AFTER + 0.5 + FRAME, false)
    expect(scene.lockProgress).toBe(0)
  })

  it('keeps the locked quad and ignores new detections after lock-on', () => {
    const locked = gridAt(50, 300)
    const scene = run(warm(), locked, AFTER, AFTER + 3)
    const lockedAt = scene.lockedAt
    expect(lockedAt).toBeGreaterThan(0)
    stepScene(scene, gridAt(50, 100, 200), AFTER + 3 + FRAME, false)
    stepScene(scene, null, AFTER + 3 + 2 * FRAME, false)
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

  describe('settle time', () => {
    it('keeps the progress at 0 during the warm-up, then locks on after WARMUP and LOCK_DWELL', () => {
      const scene = createScene(VIEW)
      for (let t = 0; t < WARMUP - 1e-9; t += FRAME) {
        stepScene(scene, detection(gridAt(50, 300)), t, false)
        expect(scene.lockProgress).toBe(0)
      }
      expect(scene.steady).toBe(true)
      run(scene, gridAt(50, 300), WARMUP, WARMUP + LOCK_DWELL - 2 * FRAME)
      expect(scene.lockedAt).toBe(-1)
      run(scene, gridAt(50, 300), WARMUP + LOCK_DWELL - FRAME, 5)
      expect(Math.abs(scene.lockedAt - (WARMUP + LOCK_DWELL))).toBeLessThanOrEqual(FRAME)
    })

    it('counts the warm-up from the first frame of the scene', () => {
      const scene = run(createScene(VIEW), gridAt(50, 300), 10, 10 + WARMUP + LOCK_DWELL + 0.5)
      expect(Math.abs(scene.lockedAt - (10 + WARMUP + LOCK_DWELL))).toBeLessThanOrEqual(FRAME)
    })
  })

  describe('minimum grid size', () => {
    // 120 pt and 150 pt in a view 402 pt wide: below and above MIN_GRID_WIDTH.
    const small = gridAt(140, 300, 120)
    const big = gridAt(130, 295, 150)

    it('uses test grids on both sides of the limit', () => {
      expect(120 / VIEW.width).toBeLessThan(MIN_GRID_WIDTH)
      expect(150 / VIEW.width).toBeGreaterThan(MIN_GRID_WIDTH)
    })

    it('never locks on a grid smaller than MIN_GRID_WIDTH of the view', () => {
      const scene = createScene(VIEW)
      for (let t = 0; t <= 5; t += FRAME) {
        stepScene(scene, detection(small), t, false)
        expect(scene.lockProgress).toBe(0)
      }
      expect(scene.steady).toBe(true)
      expect(scene.lockedAt).toBe(-1)
    })

    it('counts the dwell from the time the grid becomes big enough', () => {
      const scene = run(createScene(VIEW), small, 0, 3)
      const grown = 3 + FRAME
      // A step this small is not a jump, so foundAt stays at 0.
      run(scene, big, grown, grown + LOCK_DWELL - 2 * FRAME)
      expect(scene.foundAt).toBe(0)
      expect(scene.lockedAt).toBe(-1)
      expect(scene.lockProgress).toBeGreaterThan(0)
      run(scene, big, grown + LOCK_DWELL - FRAME, grown + LOCK_DWELL + 0.5)
      expect(Math.abs(scene.lockedAt - (grown + LOCK_DWELL))).toBeLessThanOrEqual(FRAME)
    })

    /** A square grid with its centre at (200, 450), so a change of size is a small step and not a jump. */
    const square = (size: number) => gridAt(200 - size / 2, 450 - size / 2, size)

    it('drops the progress to 0 when the grid shrinks below the limit, and counts the dwell again from the regrowth', () => {
      const scene = run(createScene(VIEW), null, 0, AFTER - FRAME)
      run(scene, square(200), AFTER, AFTER + 0.5)
      expect(scene.lockProgress).toBeGreaterThan(0)
      // Two steps of 40 pt, each a small step, so the scene stays steady and sees no jump.
      run(scene, square(160), AFTER + 0.5 + FRAME, AFTER + 0.6)
      run(scene, square(120), AFTER + 0.6 + FRAME, AFTER + 1.6)
      expect(120 / VIEW.width).toBeLessThan(MIN_GRID_WIDTH - GRID_WIDTH_HYSTERESIS)
      expect(scene.steady).toBe(true)
      expect(scene.lockProgress).toBe(0)
      const regrown = AFTER + 1.6 + FRAME
      run(scene, square(160), regrown, regrown + LOCK_DWELL - 2 * FRAME)
      expect(scene.lockedAt).toBe(-1)
      expect(scene.lockProgress).toBeGreaterThan(0)
      run(scene, square(160), regrown + LOCK_DWELL - FRAME, regrown + LOCK_DWELL + 0.5)
      expect(Math.abs(scene.lockedAt - (regrown + LOCK_DWELL))).toBeLessThanOrEqual(FRAME)
    })

    describe('hysteresis', () => {
      // 145 pt and 135 pt in a view 402 pt wide: just above MIN_GRID_WIDTH, and inside the hysteresis band below it.
      it('uses test grids on both sides of the limit and inside the band', () => {
        expect(145 / VIEW.width).toBeGreaterThan(MIN_GRID_WIDTH)
        expect(135 / VIEW.width).toBeLessThan(MIN_GRID_WIDTH)
        expect(135 / VIEW.width).toBeGreaterThan(MIN_GRID_WIDTH - GRID_WIDTH_HYSTERESIS)
      })

      it('keeps a big grid big while it shrinks into the band, so the progress does not flicker', () => {
        const scene = run(createScene(VIEW), null, 0, AFTER - FRAME)
        run(scene, square(145), AFTER, AFTER + 0.3)
        const bigSince = scene.bigSince
        expect(bigSince).toBe(AFTER)
        let progress = scene.lockProgress
        for (let t = AFTER + 0.3 + FRAME, i = 0; t < AFTER + 0.8; t += FRAME, i++) {
          // The size flips every quarter second; a flip every frame would make the grid unsteady.
          stepScene(scene, detection(square(Math.floor(i / 15) % 2 === 0 ? 135 : 145)), t, false)
          expect(scene.lockProgress).toBeGreaterThanOrEqual(progress)
          progress = scene.lockProgress
        }
        expect(scene.bigSince).toBe(bigSince)
        expect(scene.steady).toBe(true)
        run(scene, square(135), AFTER + 0.8, AFTER + 3)
        expect(scene.lockedAt).toBeGreaterThan(0)
      })

      it('does not make a grid in the band big', () => {
        const scene = run(createScene(VIEW), square(135), 0, 5)
        expect(scene.bigSince).toBe(-1)
        expect(scene.lockProgress).toBe(0)
        expect(scene.lockedAt).toBe(-1)
      })
    })

    it('uses the mean width of the top and bottom edges', () => {
      // Top edge 100 pt, bottom edge 200 pt: the mean is 150 pt, above the limit.
      const trapezoid: Quad = [
        { x: 150, y: 300 },
        { x: 250, y: 300 },
        { x: 300, y: 500 },
        { x: 100, y: 500 },
      ]
      expect(150 / VIEW.width).toBeGreaterThan(MIN_GRID_WIDTH)
      expect(100 / VIEW.width).toBeLessThan(MIN_GRID_WIDTH)
      const scene = run(createScene(VIEW), trapezoid, 0, 3)
      expect(scene.lockedAt).toBeGreaterThan(0)
    })
  })

  describe('a scene that starts not armed', () => {
    it('starts armed by default', () => {
      expect(createScene(VIEW).armed).toBe(true)
      expect(createScene(VIEW, false).armed).toBe(false)
    })

    it('never locks on the grid that is in view from the start', () => {
      const scene = createScene(VIEW, false)
      for (let t = 0; t <= 5; t += FRAME) {
        stepScene(scene, detection(gridAt(50, 300)), t, false)
        expect(scene.lockProgress).toBe(0)
      }
      expect(scene.steady).toBe(true)
      expect(scene.armed).toBe(false)
      expect(scene.lockedAt).toBe(-1)
    })

    it('arms after the grid is lost for REARM_LOST, then locks on after the dwell', () => {
      const grid = gridAt(50, 300)
      const scene = run(createScene(VIEW, false), grid, 0, 2)
      run(scene, null, 2 + FRAME, 2 + 0.6)
      expect(scene.armed).toBe(true)
      const back = 2 + 0.6 + FRAME
      run(scene, grid, back, back + 3)
      expect(scene.lockedAt).toBeGreaterThan(back + LOCK_DWELL)
      expect(Math.abs(scene.lockedAt - (scene.steadyAt + LOCK_DWELL))).toBeLessThanOrEqual(FRAME)
    })

    it('does not arm when the grid is lost for less than REARM_LOST', () => {
      expect(0.3).toBeLessThan(REARM_LOST)
      const grid = gridAt(50, 300)
      const scene = run(createScene(VIEW, false), grid, 0, 2)
      run(scene, null, 2 + FRAME, 2 + 0.3)
      const back = 2 + 0.3 + FRAME
      run(scene, grid, back, back + 3)
      expect(scene.armed).toBe(false)
      expect(scene.lockProgress).toBe(0)
      expect(scene.lockedAt).toBe(-1)
    })

    it('does not arm on start-up frames without a grid, longer than REARM_LOST but inside the warm-up', () => {
      expect(0.8).toBeGreaterThan(REARM_LOST)
      expect(0.8).toBeLessThan(WARMUP)
      const scene = run(createScene(VIEW, false), null, 0, 0.8)
      run(scene, gridAt(50, 300), 0.8 + FRAME, 5)
      expect(scene.armed).toBe(false)
      expect(scene.lockedAt).toBe(-1)
    })

    it('arms REARM_LOST after the warm-up when there is no grid from the start, then locks on a new grid', () => {
      const scene = run(createScene(VIEW, false), null, 0, WARMUP + REARM_LOST - 2 * FRAME)
      expect(scene.armed).toBe(false)
      run(scene, null, WARMUP + REARM_LOST - FRAME, 2)
      expect(scene.armed).toBe(true)
      const found = 2 + FRAME
      run(scene, gridAt(50, 300), found, found + 3)
      expect(scene.lockedAt).toBeGreaterThan(found + LOCK_DWELL - FRAME)
      expect(Math.abs(scene.lockedAt - (scene.steadyAt + LOCK_DWELL))).toBeLessThanOrEqual(FRAME)
    })

    it('counts a loss inside the warm-up from the end of the warm-up', () => {
      const scene = run(createScene(VIEW, false), gridAt(50, 300), 0, 0.3)
      run(scene, null, 0.3 + FRAME, WARMUP + REARM_LOST - 2 * FRAME)
      expect(scene.armed).toBe(false)
      run(scene, null, WARMUP + REARM_LOST - FRAME, WARMUP + REARM_LOST + FRAME)
      expect(scene.armed).toBe(true)
    })

    it('arms when the grid jumps to another place, then locks on after the dwell', () => {
      const scene = run(createScene(VIEW, false), gridAt(50, 100, 200), 0, 2)
      expect(scene.armed).toBe(false)
      const jump = 2 + FRAME
      stepScene(scene, gridAt(50, 550, 200), jump, false)
      expect(scene.event).toBe('found')
      expect(scene.armed).toBe(true)
      run(scene, gridAt(50, 550, 200), jump + FRAME, jump + 3)
      // The scene stays steady through the jump, so the dwell counts from foundAt.
      expect(scene.foundAt).toBe(jump)
      expect(Math.abs(scene.lockedAt - (jump + LOCK_DWELL))).toBeLessThanOrEqual(FRAME)
    })
  })
})
