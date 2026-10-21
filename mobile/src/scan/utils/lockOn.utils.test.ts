import {
  DRIFT_LIMIT,
  DRIFT_WINDOW,
  GRID_WIDTH_HYSTERESIS,
  LOCK_DWELL,
  MIN_GRID_WIDTH,
  WARMUP,
} from '@/scan/constants/lockOn.constants'
import type { Quad } from '@/utils/geometry.utils'
import { claimLock, createLockLatch, createLockOn, type LockOn, lockStatus, stepLockOn } from './lockOn.utils'

const VIEW_WIDTH = 402
const FRAME = 1 / 60

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

/** One frame. found: the grid appeared or jumped, which the scene decides. */
function step(lock: LockOn, grid: Quad | null, t: number, found = false) {
  return stepLockOn(lock, { grid, found, t, viewWidth: VIEW_WIDTH })
}

/** Steps at 60 fps from t0 to t1 with the same corners and one detection per frame. A grid after no grid is found. */
function run(lock: LockOn, quad: Quad | null, t0: number, t1: number) {
  for (let t = t0; t <= t1 + 1e-9; t += FRAME) step(lock, detection(quad), t, quad != null && lock.last == null)
  return lock
}

describe('lock-on', () => {
  // The grid comes into view after the warm-up, so the dwell counts from the found time.
  const AFTER = WARMUP + 0.5

  /** A tracker that sees no grid until AFTER. */
  function warm() {
    return run(createLockOn(), null, 0, AFTER - FRAME)
  }

  it('starts without progress and without lock-on', () => {
    const lock = createLockOn()
    expect(lock.progress).toBe(0)
    expect(lock.lockedAt).toBe(-1)
    expect(lock.fired).toBe(false)
  })

  it('grows the progress from the time the grid is found', () => {
    const lock = run(warm(), gridAt(50, 300), AFTER, AFTER + 0.5)
    expect(lock.progress).toBeCloseTo((AFTER + 0.5 - AFTER) / LOCK_DWELL, 1)
    expect(lock.progress).toBeGreaterThan(0)
    expect(lock.lockedAt).toBe(-1)
  })

  it('locks on LOCK_DWELL after the grid is found', () => {
    const lock = run(warm(), gridAt(50, 300), AFTER, AFTER + 3)
    expect(lock.progress).toBe(1)
    expect(Math.abs(lock.lockedAt - (AFTER + LOCK_DWELL))).toBeLessThanOrEqual(FRAME)
  })

  it('locks on a grid that is in view from the first frame, after the warm-up and the dwell', () => {
    const lock = run(createLockOn(), gridAt(50, 300), 0, WARMUP + LOCK_DWELL + 0.5)
    expect(Math.abs(lock.lockedAt - (WARMUP + LOCK_DWELL))).toBeLessThanOrEqual(FRAME)
  })

  it('counts the warm-up from the first frame of the tracker', () => {
    const lock = run(createLockOn(), gridAt(50, 300), 10, 10 + WARMUP + LOCK_DWELL + 0.5)
    expect(Math.abs(lock.lockedAt - (10 + WARMUP + LOCK_DWELL))).toBeLessThanOrEqual(FRAME)
  })

  it('keeps the progress at 0 during the warm-up', () => {
    const lock = createLockOn()
    for (let t = 0; t < WARMUP - 1e-9; t += FRAME) {
      step(lock, detection(gridAt(50, 300)), t, lock.last == null)
      expect(lock.progress).toBe(0)
    }
    expect(lockStatus(lock, WARMUP - FRAME).warm).toBe(false)
    run(lock, gridAt(50, 300), WARMUP, WARMUP + LOCK_DWELL - 2 * FRAME)
    expect(lock.lockedAt).toBe(-1)
  })

  it('resets the progress when the grid is lost', () => {
    const lock = run(warm(), gridAt(50, 300), AFTER, AFTER + 0.5)
    expect(lock.progress).toBeGreaterThan(0)
    step(lock, null, AFTER + 0.5 + FRAME)
    expect(lock.progress).toBe(0)
  })

  it('restarts the progress when the scene reports another grid', () => {
    const lock = run(warm(), gridAt(50, 100, 200), AFTER, AFTER + 0.5)
    expect(lock.progress).toBeGreaterThan(0)
    step(lock, gridAt(50, 550, 200), AFTER + 0.5 + FRAME, true)
    expect(lock.progress).toBe(0)
    expect(lock.drift).toBe(0)
  })

  it('does not restart the progress for a small step that the scene reports as the same grid', () => {
    const lock = run(warm(), gridAt(50, 100, 200), AFTER, AFTER + 0.5)
    const before = lock.progress
    step(lock, gridAt(50, 110, 200), AFTER + 0.5 + FRAME)
    expect(lock.progress).toBeGreaterThanOrEqual(before)
  })

  it('does not change after lock-on', () => {
    const lock = run(warm(), gridAt(50, 300), AFTER, AFTER + 3)
    const lockedAt = lock.lockedAt
    expect(lockedAt).toBeGreaterThan(0)
    step(lock, gridAt(50, 100, 200), AFTER + 3 + FRAME, true)
    step(lock, null, AFTER + 3 + 2 * FRAME)
    expect(lock.lockedAt).toBe(lockedAt)
    expect(lock.progress).toBe(1)
  })

  describe('the one-shot lock', () => {
    it('fires in the frame of lock-on only', () => {
      const lock = createLockOn()
      const firedAt: number[] = []
      for (let t = 0; t <= WARMUP + LOCK_DWELL + 1; t += FRAME) {
        step(lock, detection(gridAt(50, 300)), t, lock.last == null)
        if (lock.fired) firedAt.push(t)
      }
      expect(firedAt).toEqual([lock.lockedAt])
    })

    it('does not fire while the scan waits for the dwell', () => {
      const lock = run(warm(), gridAt(50, 300), AFTER, AFTER + LOCK_DWELL - 2 * FRAME)
      expect(lock.fired).toBe(false)
    })
  })

  describe('the minimum grid size', () => {
    // 120 pt and 150 pt in a view 402 pt wide: below and above MIN_GRID_WIDTH.
    const small = gridAt(140, 300, 120)
    // Same centre as small, so the growth moves each corner 21 pt. Over DRIFT_WINDOW that is 71 pt/s, below DRIFT_LIMIT.
    const big = gridAt(125, 285, 150)

    it('uses test grids on both sides of the limit', () => {
      expect(120 / VIEW_WIDTH).toBeLessThan(MIN_GRID_WIDTH)
      expect(150 / VIEW_WIDTH).toBeGreaterThan(MIN_GRID_WIDTH)
    })

    it('never locks on a grid smaller than MIN_GRID_WIDTH of the view', () => {
      const lock = createLockOn()
      for (let t = 0; t <= 5; t += FRAME) {
        step(lock, detection(small), t, lock.last == null)
        expect(lock.progress).toBe(0)
      }
      expect(lock.lockedAt).toBe(-1)
    })

    it('counts the dwell from the time the grid becomes big enough', () => {
      const lock = run(createLockOn(), small, 0, 3)
      const grown = 3 + FRAME
      run(lock, big, grown, grown + LOCK_DWELL - 2 * FRAME)
      expect(lock.lockedAt).toBe(-1)
      expect(lock.progress).toBeGreaterThan(0)
      run(lock, big, grown + LOCK_DWELL - FRAME, grown + LOCK_DWELL + 0.5)
      expect(Math.abs(lock.lockedAt - (grown + LOCK_DWELL))).toBeLessThanOrEqual(FRAME)
    })

    /** A square grid with its centre at (200, 450), so a change of size is a small step and not a jump. */
    const square = (size: number) => gridAt(200 - size / 2, 450 - size / 2, size)

    it('drops the progress to 0 when the grid shrinks below the limit, and counts the dwell again from the regrowth', () => {
      const lock = run(createLockOn(), null, 0, AFTER - FRAME)
      run(lock, square(200), AFTER, AFTER + 0.5)
      expect(lock.progress).toBeGreaterThan(0)
      run(lock, square(160), AFTER + 0.5 + FRAME, AFTER + 0.6)
      run(lock, square(120), AFTER + 0.6 + FRAME, AFTER + 1.6)
      expect(120 / VIEW_WIDTH).toBeLessThan(MIN_GRID_WIDTH - GRID_WIDTH_HYSTERESIS)
      expect(lock.progress).toBe(0)
      const regrown = AFTER + 1.6 + FRAME
      run(lock, square(160), regrown, regrown + LOCK_DWELL - 2 * FRAME)
      expect(lock.lockedAt).toBe(-1)
      expect(lock.progress).toBeGreaterThan(0)
      run(lock, square(160), regrown + LOCK_DWELL - FRAME, regrown + LOCK_DWELL + 0.5)
      expect(Math.abs(lock.lockedAt - (regrown + LOCK_DWELL))).toBeLessThanOrEqual(FRAME)
    })

    describe('hysteresis', () => {
      // 145 pt and 135 pt in a view 402 pt wide: just above MIN_GRID_WIDTH, and inside the hysteresis band below it.
      it('uses test grids on both sides of the limit and inside the band', () => {
        expect(145 / VIEW_WIDTH).toBeGreaterThan(MIN_GRID_WIDTH)
        expect(135 / VIEW_WIDTH).toBeLessThan(MIN_GRID_WIDTH)
        expect(135 / VIEW_WIDTH).toBeGreaterThan(MIN_GRID_WIDTH - GRID_WIDTH_HYSTERESIS)
      })

      it('keeps a big grid big while it shrinks into the band, so the progress does not flicker', () => {
        const lock = run(createLockOn(), null, 0, AFTER - FRAME)
        run(lock, square(145), AFTER, AFTER + 0.3)
        const bigSince = lock.bigSince
        expect(bigSince).toBe(AFTER)
        let progress = lock.progress
        for (let t = AFTER + 0.3 + FRAME, i = 0; t < AFTER + 0.8; t += FRAME, i++) {
          // The size flips every quarter second; a flip every frame would make a clear move.
          step(lock, detection(square(Math.floor(i / 15) % 2 === 0 ? 135 : 145)), t)
          expect(lock.progress).toBeGreaterThanOrEqual(progress)
          progress = lock.progress
        }
        expect(lock.bigSince).toBe(bigSince)
        run(lock, square(135), AFTER + 0.8, AFTER + 3)
        expect(lock.lockedAt).toBeGreaterThan(0)
      })

      it('does not make a grid in the band big', () => {
        const lock = run(createLockOn(), square(135), 0, 5)
        expect(lock.bigSince).toBe(-1)
        expect(lock.progress).toBe(0)
        expect(lock.lockedAt).toBe(-1)
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
      expect(150 / VIEW_WIDTH).toBeGreaterThan(MIN_GRID_WIDTH)
      expect(100 / VIEW_WIDTH).toBeLessThan(MIN_GRID_WIDTH)
      expect(run(createLockOn(), trapezoid, 0, 3).lockedAt).toBeGreaterThan(0)
    })
  })
})

/** Detections at 30 fps, frames at 120 fps: each detection lasts 4 frames. at(t) gives the corners of a detection at time t. */
function camera(lock: LockOn, at: (t: number, k: number) => Quad, t0: number, t1: number) {
  let quad: Quad | null = null
  let k = 0
  for (let t = t0; t <= t1 + 1e-9; t += 1 / 120, k++) {
    if (k % 4 === 0) quad = at(t, k)
    step(lock, quad, t, lock.last == null)
  }
  return lock
}

/** A still page in a hand: every corner moves up to 3 pt per detection, and the hand sways 5 pt at 1 Hz. */
function handHeld(t: number, k: number): Quad {
  const sway = 5 * Math.sin(2 * Math.PI * t)
  return gridAt(50, 300).map((p, i) => ({
    x: p.x + sway + 3 * Math.sin(k * 1.3 + i * 2.1),
    y: p.y + 3 * Math.cos(k * 0.7 + i * 1.7),
  })) as Quad
}

/** A pan over the page: the grid sweeps 100 pt left and right at 200 pt/s. */
function panning(t: number): Quad {
  const phase = (t * 2) % 2
  return gridAt(20 + 100 * (phase < 1 ? phase : 2 - phase), 300, 250)
}

describe('lock-on on a tracked grid', () => {
  it('locks on a hand-held grid after the warm-up and the dwell', () => {
    const lock = camera(createLockOn(), handHeld, 0, WARMUP + LOCK_DWELL + 0.5)
    expect(lock.lockedAt).toBeGreaterThanOrEqual(WARMUP + LOCK_DWELL)
    expect(lock.lockedAt).toBeLessThanOrEqual(WARMUP + LOCK_DWELL + 0.05)
  })

  it('keeps the drift of a hand-held grid below DRIFT_LIMIT', () => {
    const lock = createLockOn()
    let most = 0
    camera(
      lock,
      (t, k) => {
        most = Math.max(most, lock.drift)
        return handHeld(t, k)
      },
      0,
      WARMUP,
    )
    expect(most).toBeGreaterThan(0)
    expect(most).toBeLessThanOrEqual(DRIFT_LIMIT)
  })

  it('stops lock-on within DRIFT_LIMIT × DRIFT_WINDOW of a pan that starts late in the dwell', () => {
    for (const start of [1.6, 1.7, 1.8, 1.9, 1.95]) {
      const at = (t: number) => detection(gridAt(30 + 300 * Math.max(0, t - start), 300, 250)) as Quad
      const lock = camera(createLockOn(), at, 0, start + 0.35)
      const moved = lock.lockedAt < 0 ? 0 : 300 * Math.max(0, lock.lockedAt - start)
      // One detection step of slack: the camera sees the grid at 30 fps.
      expect(moved).toBeLessThanOrEqual(DRIFT_LIMIT * DRIFT_WINDOW + 300 / 30)
    }
  })

  it('never locks on while the player pans over the page', () => {
    const lock = camera(createLockOn(), (t) => panning(t), 0, 5)
    expect(lock.lockedAt).toBe(-1)
    expect(lock.drift).toBeGreaterThan(0)
  })

  it('reports moving during a pan', () => {
    const lock = createLockOn()
    let seen = false
    camera(
      lock,
      (t) => {
        seen = seen || lockStatus(lock, t).moving
        return panning(t)
      },
      0,
      2,
    )
    expect(seen).toBe(true)
  })

  it('locks on LOCK_DWELL after a pan stops', () => {
    const lock = camera(createLockOn(), (t) => panning(t), 0, 2)
    const still = lock.last!
    camera(lock, () => still, 2 + 1 / 120, 4)
    expect(lock.lockedAt).toBeGreaterThanOrEqual(2 + LOCK_DWELL)
    expect(lock.lockedAt).toBeLessThanOrEqual(2 + LOCK_DWELL + 2 * DRIFT_WINDOW + 0.05)
  })
})

describe('lockStatus', () => {
  it('reports no grid as a width of 0 and not big', () => {
    const status = lockStatus(run(createLockOn(), null, 0, 2), 2)
    expect(status.width).toBe(0)
    expect(status.big).toBe(false)
    expect(status.progress).toBe(0)
    expect(status.locked).toBe(false)
  })

  it('reports not warm in the warm-up', () => {
    const status = lockStatus(run(createLockOn(), gridAt(50, 300), 0, WARMUP / 2), WARMUP / 2)
    expect(status.warm).toBe(false)
    expect(status.progress).toBe(0)
  })

  it('reports every rule as passed for a big grid after the warm-up', () => {
    const t = WARMUP + LOCK_DWELL / 2
    const status = lockStatus(run(createLockOn(), gridAt(50, 300), 0, t), t)
    expect(status).toMatchObject({ moving: false, big: true, warm: true, locked: false })
    expect(status.width).toBeCloseTo(300 / VIEW_WIDTH)
    expect(status.progress).toBeGreaterThan(0)
    expect(status.progress).toBeLessThan(1)
  })

  it('reports locked after the dwell', () => {
    const t = WARMUP + LOCK_DWELL + 0.1
    const status = lockStatus(run(createLockOn(), gridAt(50, 300), 0, t), t)
    expect(status.locked).toBe(true)
    expect(status.progress).toBe(1)
  })
})

describe('the shutter and the automatic lock race', () => {
  const AUTO_AT = WARMUP + LOCK_DWELL

  it('starts the scan once when the shutter comes first', () => {
    const latch = createLockLatch()
    expect(claimLock(latch, 'shutter', 100)).toBe(true)
    expect(claimLock(latch, 'auto', 101)).toBe(false)
    expect(latch).toEqual({ source: 'shutter', at: 100 })
  })

  it('starts the scan once when the automatic lock comes first', () => {
    const latch = createLockLatch()
    expect(claimLock(latch, 'auto', 100)).toBe(true)
    expect(claimLock(latch, 'shutter', 101)).toBe(false)
    expect(latch).toEqual({ source: 'auto', at: 100 })
  })

  it('refuses a second claim of the same source', () => {
    const latch = createLockLatch()
    expect(claimLock(latch, 'auto', 100)).toBe(true)
    expect(claimLock(latch, 'auto', 200)).toBe(false)
    expect(latch.at).toBe(100)
  })

  it('starts the scan once when the shutter is pressed in the frame of the automatic lock', () => {
    const lock = createLockOn()
    const latch = createLockLatch()
    let starts = 0
    for (let t = 0; t <= AUTO_AT + 1; t += FRAME) {
      step(lock, detection(gridAt(50, 300)), t, lock.last == null)
      // The tracker fires on the UI thread, and the call reaches the JS thread. The shutter can arrive before or after it.
      const arrivals: ('auto' | 'shutter')[] = lock.fired ? ['shutter', 'auto'] : []
      for (const source of arrivals) if (claimLock(latch, source, t)) starts++
    }
    expect(starts).toBe(1)
    expect(latch.source).toBe('shutter')
  })
})
