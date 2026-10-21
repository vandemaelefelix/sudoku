import { transitionAt } from '@/scan/utils/transition.utils'
import { LOCK_DWELL, WARMUP } from '@/scan/constants/lockOn.constants'
import { advance, advanceCapture, formatLockReport, lockReport } from './engine'
import type { AnyEffect } from './types'
import type { Quad } from '@/utils/geometry.utils'
import { project } from '@/utils/homography.utils'

const VIEW = { width: 402, height: 874 }

const grid: Quad = [
  { x: 50, y: 300 },
  { x: 350, y: 300 },
  { x: 350, y: 600 },
  { x: 50, y: 600 },
]

function fakeEffect(id: string) {
  return {
    id,
    name: id,
    family: 'path',
    create: jest.fn(() => ({ id })),
    step: jest.fn((state: unknown) => state),
    draw: jest.fn(),
  } satisfies AnyEffect
}

describe('advance', () => {
  it('creates the effect on the first frame, then steps it', () => {
    const a = fakeEffect('a')
    const engine = advance(null, a, VIEW, null, 1, false)
    expect(a.create).toHaveBeenCalledTimes(1)
    expect(a.step).toHaveBeenCalledWith({ id: 'a' }, engine.scene)
    expect(engine.state).toEqual({ id: 'a' })
    expect(engine.scene.t).toBe(1)
  })

  it('keeps the state from frame to frame', () => {
    const a = fakeEffect('a')
    const first = advance(null, a, VIEW, null, 1, false)
    const second = advance(first, a, VIEW, null, 1 + 1 / 60, false)
    expect(a.create).toHaveBeenCalledTimes(1)
    expect(a.step).toHaveBeenCalledTimes(2)
    expect(second.state).toBe(first.state)
  })

  it('creates the new effect on a switch and keeps the scene', () => {
    const a = fakeEffect('a')
    const b = fakeEffect('b')
    const first = advance(null, a, VIEW, grid, 1, false)
    const second = advance(first, b, VIEW, grid, 1 + 1 / 60, false)
    expect(b.create).toHaveBeenCalledTimes(1)
    expect(second.scene).toBe(first.scene)
    expect(second.scene.foundAt).toBe(1)
    expect(second.state).toEqual({ id: 'b' })
    expect(second.id).toBe('b')
  })

  it('re-creates when the effect at the index changes', () => {
    const a = fakeEffect('a')
    const b = fakeEffect('b')
    const first = advance(null, a, VIEW, null, 1, false)
    const second = advance(first, b, VIEW, null, 1 + 1 / 60, false)
    expect(b.create).toHaveBeenCalledTimes(1)
    expect(b.step).toHaveBeenCalledWith({ id: 'b' }, second.scene)
    expect(second.state).toEqual({ id: 'b' })
  })

  it('does not re-create when an invalid index falls back to the same effect', () => {
    const first = advance(null, fakeEffect('a'), VIEW, null, 1, false)
    const again = fakeEffect('a')
    const second = advance(first, again, VIEW, null, 1 + 1 / 60, false)
    expect(again.create).not.toHaveBeenCalled()
    expect(second.state).toBe(first.state)
  })

  it('creates the effect and a new scene when the view size changes', () => {
    const a = fakeEffect('a')
    const first = advance(null, a, VIEW, null, 1, false)
    const second = advance(first, a, { width: 804, height: 874 }, null, 1.1, false)
    expect(a.create).toHaveBeenCalledTimes(2)
    expect(second.scene).not.toBe(first.scene)
    expect(second.scene.width).toBe(804)
  })

  it('passes Reduce Motion to the scene', () => {
    const engine = advance(null, fakeEffect('a'), VIEW, null, 1, true)
    expect(engine.scene.reduceMotion).toBe(true)
  })

  it('starts without capture channels', () => {
    expect(advance(null, fakeEffect('a'), VIEW, grid, 1, false).scene.capture).toBeNull()
  })
})

/** Runs a still grid until the scene locks on. A new quad object per frame, as the camera gives one per detection. */
function lockedEngine(effect: AnyEffect) {
  let engine = advance(null, effect, VIEW, grid, 0, false)
  for (let t = 1 / 60; t <= 2.5; t += 1 / 60)
    engine = advance(engine, effect, VIEW, grid.map((p) => ({ ...p })) as Quad, t, false)
  expect(engine.scene.lockedAt).toBeGreaterThan(0)
  return engine
}

describe('lock-on in the engine', () => {
  const a = fakeEffect('a')

  /** Frames at 60 fps with a new quad object per frame, as the camera gives one per detection. */
  function runFrames(start: ReturnType<typeof advance> | null, t0: number, t1: number) {
    let engine = start
    for (let t = t0; t <= t1 + 1e-9; t += 1 / 60)
      engine = advance(engine, a, VIEW, grid.map((p) => ({ ...p })) as Quad, t, false)
    return engine!
  }

  it('gives the scene the progress and the lock time of the tracker', () => {
    const halfway = runFrames(null, 0, WARMUP + LOCK_DWELL / 2)
    expect(halfway.scene.lockProgress).toBe(halfway.lockOn.progress)
    expect(halfway.scene.lockProgress).toBeGreaterThan(0)
    expect(halfway.scene.lockProgress).toBeLessThan(1)
    expect(halfway.scene.lockedAt).toBe(-1)
    const locked = runFrames(halfway, WARMUP + LOCK_DWELL / 2 + 1 / 60, WARMUP + LOCK_DWELL + 0.2)
    expect(locked.scene.lockProgress).toBe(1)
    expect(locked.scene.lockedAt).toBe(locked.lockOn.lockedAt)
  })

  it('fires in the frame of lock-on only', () => {
    let engine = advance(null, a, VIEW, grid, 0, false)
    const fired: number[] = []
    for (let t = 1 / 60; t <= WARMUP + LOCK_DWELL + 1; t += 1 / 60) {
      engine = advance(engine, a, VIEW, grid.map((p) => ({ ...p })) as Quad, t, false)
      if (engine.lockOn.fired) fired.push(t)
    }
    expect(fired).toEqual([engine.lockOn.lockedAt])
  })

  it('holds the locked quad after lock-on', () => {
    const locked = runFrames(null, 0, WARMUP + LOCK_DWELL + 0.2)
    const quad = locked.scene.quad
    const later = advance(locked, a, VIEW, null, locked.scene.t + 1 / 60, false)
    expect(later.scene.quad).toBe(quad)
    expect(later.scene.lockedAt).toBe(locked.scene.lockedAt)
  })

  it('keeps the tracker on an effect switch', () => {
    const first = runFrames(null, 0, 0.5)
    const second = advance(first, fakeEffect('b'), VIEW, grid, 0.6, false)
    expect(second.lockOn).toBe(first.lockOn)
  })

  it('starts a new tracker when the view size changes', () => {
    const first = runFrames(null, 0, WARMUP + LOCK_DWELL + 0.2)
    expect(first.lockOn.lockedAt).toBeGreaterThan(0)
    const second = advance(first, a, { width: 804, height: 874 }, grid, first.scene.t + 1 / 60, false)
    expect(second.lockOn).not.toBe(first.lockOn)
    expect(second.scene.lockedAt).toBe(-1)
  })
})

describe('lockReport', () => {
  const a = fakeEffect('a')

  function runFrames(quad: Quad | null, t1: number) {
    let engine = advance(null, a, VIEW, quad, 0, false)
    for (let t = 1 / 60; t <= t1 + 1e-9; t += 1 / 60)
      engine = advance(engine, a, VIEW, quad == null ? null : (quad.map((p) => ({ ...p })) as Quad), t, false)
    return engine
  }

  it('reports no grid when none is in view', () => {
    const report = lockReport(runFrames(null, 2))
    expect(report.grid).toBe(false)
    expect(report.width).toBe(0)
    expect(report.steady).toBe(false)
    expect(report.progress).toBe(0)
  })

  it('reports the scene facts with the tracker rules for a steady big grid after the warm-up', () => {
    const report = lockReport(runFrames(grid, WARMUP + LOCK_DWELL / 2))
    expect(report).toMatchObject({ grid: true, steady: true, big: true, warm: true, locked: false })
    expect(report.motion).toBeLessThan(0.5)
    expect(report.progress).toBeGreaterThan(0)
  })

  it('reports locked after the dwell', () => {
    const report = lockReport(runFrames(grid, WARMUP + LOCK_DWELL + 0.1))
    expect(report.locked).toBe(true)
    expect(report.progress).toBe(1)
  })

  it('formats one line with every rule', () => {
    const line = formatLockReport({
      grid: true,
      steady: false,
      motion: 0.618,
      speed: 18.56,
      drift: 12.34,
      moving: false,
      width: 0.7462,
      big: true,
      warm: true,
      progress: 0,
      locked: false,
    })
    expect(line).toBe(
      'grid yes, steady no (motion 0.62, speed 18.6 pt/s), drift 12.3 pt/s moving no, width 0.75 big yes, warm yes, progress 0.00, locked no',
    )
  })
})

describe('advanceCapture', () => {
  const flat: Quad = [
    { x: 16, y: 120 },
    { x: 386, y: 120 },
    { x: 386, y: 490 },
    { x: 16, y: 490 },
  ]

  it('ignores the lock-on latch and uses the given quad', () => {
    const a = fakeEffect('a')
    const engine = lockedEngine(a)
    const channels = transitionAt(0.3, false)
    const previous = engine.scene.t
    const next = advanceCapture(engine, a, flat, 2.55, channels, false)
    expect(next.scene.quad).toBe(flat)
    expect(next.scene.lastQuad).toBe(flat)
    expect(project(next.scene.m!, 1, 1).x).toBeCloseTo(386, 6)
    expect(project(next.scene.inverse!, 386, 490).y).toBeCloseTo(1, 6)
    expect(next.scene.capture).toBe(channels)
    expect(next.scene.event).toBe('none')
    expect(next.scene.t).toBe(2.55)
    expect(next.scene.dt).toBeCloseTo(2.55 - previous, 9)
  })

  it('clears the fired flag and keeps the tracker', () => {
    const a = fakeEffect('a')
    const engine = lockedEngine(a)
    engine.lockOn.fired = true
    const next = advanceCapture(engine, a, flat, 2.55, transitionAt(0.3, false), false)
    expect(next.lockOn).toBe(engine.lockOn)
    expect(next.lockOn.fired).toBe(false)
    expect(next.lockOn.lockedAt).toBe(next.scene.lockedAt)
  })

  it('steps the effect with the scene and keeps its state', () => {
    const a = fakeEffect('a')
    const engine = lockedEngine(a)
    const before = engine.state
    const next = advanceCapture(engine, a, flat, 2.6, transitionAt(0.3, false), false)
    expect(a.step).toHaveBeenLastCalledWith(before, next.scene)
    expect(next.state).toBe(before)
  })

  it('steps the effect as under Reduce Motion in the cross-fade', () => {
    const a = fakeEffect('a')
    const warp = advanceCapture(lockedEngine(a), a, flat, 2.6, transitionAt(0.3, false), false)
    expect(warp.scene.reduceMotion).toBe(false)
    const crossFade = advanceCapture(lockedEngine(a), a, flat, 2.6, transitionAt(0.1, true), true)
    expect(crossFade.scene.reduceMotion).toBe(true)
  })

  it('leaves the capture phase on the next live frame', () => {
    const a = fakeEffect('a')
    const captured = advanceCapture(lockedEngine(a), a, flat, 2.6, transitionAt(0.3, false), false)
    expect(advance(captured, a, VIEW, grid, 2.7, false).scene.capture).toBeNull()
  })
})
