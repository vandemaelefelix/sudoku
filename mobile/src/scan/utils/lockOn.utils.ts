import {
  DRIFT_LIMIT,
  DRIFT_MIN_SPAN,
  DRIFT_WINDOW,
  GRID_WIDTH_HYSTERESIS,
  LOCK_DWELL,
  MIN_GRID_WIDTH,
  WARMUP,
} from '@/scan/constants/lockOn.constants'
import { largestCornerStep, type Quad } from '@/utils/geometry.utils'

// The lock-on tracker (ADR-019). It runs as a worklet on the UI thread, one step per frame, and holds plain data.
// The effect scene does not know its rules. The engine gives it the grid of each frame and copies progress and lockedAt back.

/**
 * progress: 0..1, see LOCK_DWELL. 1 from lock-on. lockedAt: the time of lock-on, or -1. fired: true only in the frame of lock-on.
 * drift: the largest net corner move over the last DRIFT_WINDOW, in points per second, measured in every frame. 0 until the track spans DRIFT_MIN_SPAN.
 * Lock-on reads the drift, not the steady state, because a hand never holds a phone still.
 * width: the grid width as a share of the view width, 0 without a grid. bigSince: the time the grid became at least MIN_GRID_WIDTH wide, or -1. See GRID_WIDTH_HYSTERESIS.
 * startedAt: the time of the first frame, or -1. foundAt: the time of the last found event, or -1. movedAt: the last time the drift was above DRIFT_LIMIT, or -1.
 * last: the grid of the previous frame. track: the detections of the last DRIFT_WINDOW, oldest first.
 */
export type LockOn = {
  progress: number
  lockedAt: number
  fired: boolean
  drift: number
  width: number
  bigSince: number
  startedAt: number
  foundAt: number
  movedAt: number
  last: Quad | null
  track: { quad: Quad; t: number }[]
}

/**
 * grid: the grid of this frame in view points, or null. The camera sends a new quad object per detection, so the tracker counts a new object as a new detection.
 * found: the grid is a new one, because it appeared or jumped. t: seconds. viewWidth: points.
 */
export type LockFrame = { grid: Quad | null; found: boolean; t: number; viewWidth: number }

export function createLockOn(): LockOn {
  'worklet'
  return {
    progress: 0,
    lockedAt: -1,
    fired: false,
    drift: 0,
    width: 0,
    bigSince: -1,
    startedAt: -1,
    foundAt: -1,
    movedAt: -1,
    last: null,
    track: [],
  }
}

/** The mean length of the top and bottom edges, in view points. */
function gridWidth(quad: Quad): number {
  'worklet'
  return (
    (Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y) +
      Math.hypot(quad[2].x - quad[3].x, quad[2].y - quad[3].y)) /
    2
  )
}

/**
 * Advances the tracker by one frame. Mutates and returns lock.
 * The dwell counts from the latest of the found time, the last clear move, the end of the warm-up and the time the grid became big enough.
 * From lock-on it does nothing, so lock-on happens once.
 */
export function stepLockOn(lock: LockOn, frame: LockFrame): LockOn {
  'worklet'
  const { grid, found, t, viewWidth } = frame
  lock.fired = false
  if (lock.lockedAt >= 0) return lock
  if (lock.startedAt < 0) lock.startedAt = t
  if (found) lock.foundAt = t
  const changed = grid !== lock.last
  lock.last = grid
  // A new grid starts a new track, so a jump never counts as a move. The oldest entry is the newest detection that is at least DRIFT_WINDOW old.
  if (grid == null || found) {
    lock.track = grid == null ? [] : [{ quad: grid, t }]
    lock.drift = 0
  } else {
    if (changed) lock.track.push({ quad: grid, t })
    const track = lock.track
    while (track.length > 1 && t - track[1]!.t >= DRIFT_WINDOW) track.shift()
    const oldest = track[0]
    const span = oldest == null ? 0 : t - oldest.t
    lock.drift = oldest != null && span >= DRIFT_MIN_SPAN ? largestCornerStep(grid, oldest.quad) / span : 0
  }
  const moving = lock.drift > DRIFT_LIMIT
  if (moving) lock.movedAt = t
  if (grid == null) {
    lock.width = 0
    lock.bigSince = -1
  } else {
    const width = gridWidth(grid)
    lock.width = viewWidth <= 0 ? 0 : width / viewWidth
    const limit = lock.bigSince >= 0 ? MIN_GRID_WIDTH - GRID_WIDTH_HYSTERESIS : MIN_GRID_WIDTH
    if (width < limit * viewWidth) lock.bigSince = -1
    else if (lock.bigSince < 0) lock.bigSince = t
  }
  // foundAt also moves on a jump, so a switch to another grid starts the dwell again. movedAt does the same after a pan.
  const since = Math.max(lock.foundAt, lock.movedAt, lock.startedAt + WARMUP, lock.bigSince)
  const ready = !moving && lock.bigSince >= 0
  lock.progress = ready ? Math.min(1, Math.max(0, (t - since) / LOCK_DWELL)) : 0
  if (lock.progress >= 1) {
    lock.lockedAt = t
    lock.fired = true
  }
  return lock
}

/** The rules of the tracker in one frame, for the development log. The scene adds the facts that it owns. */
export type LockStatus = {
  drift: number
  moving: boolean
  width: number
  big: boolean
  warm: boolean
  progress: number
  locked: boolean
}

/** t: the time of the frame. */
export function lockStatus(lock: LockOn, t: number): LockStatus {
  'worklet'
  return {
    drift: lock.drift,
    moving: lock.drift > DRIFT_LIMIT,
    width: lock.width,
    big: lock.bigSince >= 0,
    warm: lock.startedAt >= 0 && t - lock.startedAt >= WARMUP,
    progress: lock.progress,
    locked: lock.lockedAt >= 0,
  }
}

/** The two ways a scan starts: the tracker gives 'auto', the shutter button gives 'shutter'. */
export type LockSource = 'auto' | 'shutter'

/** at: the clock time of the winning claim, in milliseconds. */
export type LockLatch = { source: LockSource | null; at: number }

export function createLockLatch(): LockLatch {
  return { source: null, at: 0 }
}

/**
 * Both sources call this on the JS thread. The first call wins and gets true. Every later call gets false.
 * A shutter press and the tracker can fire in the same moment, and the scan must start once.
 */
export function claimLock(latch: LockLatch, source: LockSource, at: number): boolean {
  if (latch.source != null) return false
  latch.source = source
  latch.at = at
  return true
}
