import { createPicture } from '@shopify/react-native-skia'
import { render, screen } from '@testing-library/react-native'
import { type SharedValue, useFrameCallback, useReducedMotion } from 'react-native-reanimated'
import type { Quad } from '../../scanner'
import type { ViewSize } from '../previewMapping'
import { EffectCanvas } from './EffectCanvas'
import { DEFAULT_INDEX, effectIndex } from './index'

const frameCallback = jest.mocked(useFrameCallback)
const picture = jest.mocked(createPicture)
const reducedMotion = jest.mocked(useReducedMotion)

const VIEW = { width: 402, height: 874 }

const grid: Quad = [
  { x: 50, y: 300 },
  { x: 350, y: 300 },
  { x: 350, y: 600 },
  { x: 50, y: 600 },
]

/** A shared value stand-in. get() reads value, so a test can change value between frames with Object.assign. */
function shared<T>(value: T) {
  const holder = {
    value,
    get: () => holder.value,
    set: jest.fn((next: T) => {
      holder.value = next
    }),
  }
  return holder as unknown as SharedValue<T>
}

/** Runs the last registered frame callback at time t (seconds). */
function tick(t: number) {
  const callback = frameCallback.mock.calls.at(-1)![0]
  callback({ timestamp: t * 1000, timeSincePreviousFrame: 16, timeSinceFirstFrame: t * 1000 })
}

/** Draws the last recorded picture into a fake canvas. */
function lastFrame() {
  const draw = picture.mock.calls.at(-1)![0]
  const canvas = { drawAtlas: jest.fn(), drawPath: jest.fn(), drawRect: jest.fn() }
  draw(canvas as never)
  return canvas
}

function renderCanvas(view: ViewSize, effect = DEFAULT_INDEX, outline: Quad | null = null) {
  const props = { outline: shared(outline), view: shared(view), effect: shared(effect) }
  render(<EffectCanvas {...props} />)
  return props
}

beforeEach(() => {
  jest.clearAllMocks()
  reducedMotion.mockReturnValue(false)
})

describe('EffectCanvas', () => {
  it('draws on a canvas that ignores touches', () => {
    renderCanvas(VIEW)
    expect(screen.getByTestId('skia-canvas').props.pointerEvents).toBe('none')
    expect(screen.getByTestId('skia-picture')).toBeTruthy()
  })

  it('waits for the view size', () => {
    renderCanvas({ width: 0, height: 0 })
    picture.mockClear()
    tick(1)
    expect(picture).not.toHaveBeenCalled()
  })

  it('draws the gathering dots after the first frame', () => {
    renderCanvas(VIEW)
    tick(1)
    expect(lastFrame().drawAtlas.mock.calls[0][2]).toHaveLength(312)
  })

  it('rebuilds the effect when the view size changes', () => {
    const props = renderCanvas(VIEW)
    tick(1)
    Object.assign(props.view, { value: { width: 804, height: 874 } })
    tick(1.1)
    expect(lastFrame().drawAtlas.mock.calls[0][2]).toHaveLength(24 * 26)
  })

  it('runs the default effect for an index out of range', () => {
    renderCanvas(VIEW, 99)
    tick(1)
    expect(lastFrame().drawAtlas.mock.calls[0][2]).toHaveLength(312)
  })

  it('keeps the free dots still under Reduce Motion', () => {
    reducedMotion.mockReturnValue(true)
    renderCanvas(VIEW)
    tick(1)
    const before = lastFrame().drawAtlas.mock.calls[0][2]
    tick(5)
    expect(lastFrame().drawAtlas.mock.calls[0][2]).toEqual(before)
  })

  it('logs the effect id with the frame rate', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    renderCanvas(VIEW)
    for (let i = 0; i <= 62; i++) tick(1 + i / 60)
    await Promise.resolve()
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\[fx\] gathering-dots \d+\.\d fps, overlay \d+\.\d\d ms$/))
    log.mockRestore()
  })

  it('switches to another effect on the next frame and draws nothing of the old one', () => {
    const props = renderCanvas(VIEW, DEFAULT_INDEX, grid)
    tick(1)
    expect(lastFrame().drawAtlas).toHaveBeenCalledTimes(1)
    Object.assign(props.effect, { value: effectIndex('spotlight-brackets') })
    tick(1 + 1 / 60)
    const canvas = lastFrame()
    expect(canvas.drawAtlas).not.toHaveBeenCalled()
    expect(canvas.drawPath).toHaveBeenCalledTimes(2)
  })
})
