import { transitionAt } from '@/scan/transition/timeline'
import { advance, advanceCapture } from './engine'
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

  it('creates an armed scene by default, and a scene that is not armed on request', () => {
    expect(advance(null, fakeEffect('a'), VIEW, grid, 1, false).scene.armed).toBe(true)
    expect(advance(null, fakeEffect('a'), VIEW, grid, 1, false, false).scene.armed).toBe(false)
  })

  it('keeps the scene armed state on later frames', () => {
    const first = advance(null, fakeEffect('a'), VIEW, null, 1, false, false)
    expect(advance(first, fakeEffect('a'), VIEW, null, 1 + 1 / 60, false, true).scene.armed).toBe(false)
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
