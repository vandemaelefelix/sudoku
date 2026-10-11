import type { Quad } from '../../scanner'
import { advance } from './engine'
import type { AnyEffect } from './types'

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
})
