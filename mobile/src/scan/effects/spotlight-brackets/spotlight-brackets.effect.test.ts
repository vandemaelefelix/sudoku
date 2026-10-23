import { makeDrawKit } from '@/scan/effects/kit'
import { createScene, type Scene, stepScene } from '@/scan/effects/scene'
import { bracketPath, spotlightBrackets } from './spotlight-brackets.effect'
import { BRACKET_BASE, BRACKET_STEADY, BRACKET_WIDTH, DIM_BASE, DIM_STEADY } from './spotlight-brackets.constants'
import { cobalt } from '@/theme/themes/cobalt'
import { fakeCanvas, GRID, VIEW } from '@/scan/effects/effect.testkit'

const INK = cobalt.components.grid.boxLine

/** A scene with the grid found, at the given presence and lock-on progress. */
function sceneWith(presence: number, lockProgress: number): Scene {
  return { ...stepScene(createScene(VIEW), GRID, 0, false), presence, lockProgress }
}

const mocked = (paint: unknown) => paint as { setAlphaf: jest.Mock; setStrokeWidth: jest.Mock }

describe('spotlightBrackets', () => {
  it('is the path effect with a stable id and no state', () => {
    const scene = sceneWith(1, 0)
    expect(spotlightBrackets.id).toBe('spotlight-brackets')
    expect(spotlightBrackets.name).toBe('Spotlight and brackets')
    expect(spotlightBrackets.family).toBe('path')
    expect(spotlightBrackets.create(scene)).toBeNull()
    expect(spotlightBrackets.step(null, scene)).toBeNull()
  })

  it('draws nothing before a grid is found', () => {
    const scene = stepScene(createScene(VIEW), null, 0, false)
    const canvas = fakeCanvas()
    spotlightBrackets.draw(canvas as never, null, scene, makeDrawKit([], INK))
    expect(canvas.drawPath).not.toHaveBeenCalled()
  })

  it('dims outside the grid and draws short brackets while the corners move', () => {
    const kit = makeDrawKit([], INK)
    const canvas = fakeCanvas()
    spotlightBrackets.draw(canvas as never, null, sceneWith(1, 0), kit)
    expect(canvas.drawPath).toHaveBeenCalledTimes(2)
    const [hole, fill] = canvas.drawPath.mock.calls[0]
    expect(fill).toBe(kit.fill)
    expect(hole.calls).toContainEqual(['setFillType', 1])
    expect(mocked(kit.fill).setAlphaf).toHaveBeenCalledWith(DIM_BASE)
    const [brackets, stroke] = canvas.drawPath.mock.calls[1]
    expect(stroke).toBe(kit.stroke)
    expect(brackets.calls.filter((call: unknown[]) => call[0] === 'moveTo')).toHaveLength(4)
    expect(brackets.calls[0]).toEqual(['moveTo', 50, 300 + 300 * BRACKET_BASE])
  })

  it('deepens the dim and grows the brackets when the scan locks on', () => {
    const kit = makeDrawKit([], INK)
    const canvas = fakeCanvas()
    spotlightBrackets.draw(canvas as never, null, sceneWith(1, 1), kit)
    expect(mocked(kit.fill).setAlphaf).toHaveBeenCalledWith(DIM_BASE + DIM_STEADY)
    const brackets = canvas.drawPath.mock.calls[1][0]
    expect(brackets.calls[0]).toEqual(['moveTo', 50, 300 + 300 * (BRACKET_BASE + BRACKET_STEADY)])
  })

  it('fades the dim and the brackets in with the presence', () => {
    const kit = makeDrawKit([], INK)
    spotlightBrackets.draw(fakeCanvas() as never, null, sceneWith(0.5, 0), kit)
    expect(mocked(kit.fill).setAlphaf).toHaveBeenCalledWith(0.5 * DIM_BASE)
    expect(mocked(kit.stroke).setAlphaf).toHaveBeenCalledWith(0.5)
  })

  it('scales the bracket stroke from the prototype phone to the view', () => {
    const kit = makeDrawKit([], INK)
    spotlightBrackets.draw(fakeCanvas() as never, null, sceneWith(1, 0), kit)
    expect(mocked(kit.stroke).setStrokeWidth.mock.calls[0]?.[0]).toBeCloseTo((BRACKET_WIDTH * 402) / 220, 9)
  })
})

describe('bracketPath', () => {
  it('draws an L on each corner, along both edges', () => {
    const path = bracketPath(GRID, 0.5) as unknown as { calls: unknown[][] }
    expect(path.calls.slice(0, 3)).toEqual([
      ['moveTo', 50, 450],
      ['lineTo', 50, 300],
      ['lineTo', 200, 300],
    ])
    expect(path.calls).toHaveLength(12)
  })
})
