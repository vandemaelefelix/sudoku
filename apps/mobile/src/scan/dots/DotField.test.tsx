import { createPicture } from '@shopify/react-native-skia'
import { render, screen } from '@testing-library/react-native'
import { type SharedValue, useFrameCallback } from 'react-native-reanimated'
import type { Quad } from '../../scanner'
import type { ViewSize } from '../previewMapping'
import { DotField } from './DotField'

const frameCallback = jest.mocked(useFrameCallback)
const picture = jest.mocked(createPicture)

function shared<T>(value: T) {
  return { value, get: () => value, set: jest.fn() } as unknown as SharedValue<T>
}

/** Runs the last registered frame callback at time t (seconds). */
function tick(t: number) {
  const callback = frameCallback.mock.calls.at(-1)![0]
  callback({ timestamp: t * 1000, timeSincePreviousFrame: 16, timeSinceFirstFrame: t * 1000 })
}

/** Draws the last recorded picture into a fake canvas and counts the dots of its atlas call. */
function dotsDrawn() {
  const draw = picture.mock.calls.at(-1)![0]
  const canvas = { drawAtlas: jest.fn(), drawPath: jest.fn() }
  draw(canvas as never)
  return canvas.drawAtlas.mock.calls[0][2].length
}

beforeEach(() => jest.clearAllMocks())

describe('DotField', () => {
  it('draws on a canvas that ignores touches', () => {
    render(<DotField outline={shared<Quad | null>(null)} view={shared<ViewSize>({ width: 402, height: 874 })} />)
    expect(screen.getByTestId('skia-canvas').props.pointerEvents).toBe('none')
    expect(screen.getByTestId('skia-picture')).toBeTruthy()
  })

  it('waits for the view size', () => {
    render(<DotField outline={shared<Quad | null>(null)} view={shared<ViewSize>({ width: 0, height: 0 })} />)
    picture.mockClear()
    tick(1)
    expect(picture).not.toHaveBeenCalled()
  })

  it('draws the field after the first frame', () => {
    render(<DotField outline={shared<Quad | null>(null)} view={shared<ViewSize>({ width: 402, height: 874 })} />)
    tick(1)
    expect(dotsDrawn()).toBe(312)
  })

  it('rebuilds the field when the view size changes', () => {
    const outline = shared<Quad | null>(null)
    const view = { value: { width: 402, height: 874 } } as SharedValue<ViewSize>
    render(<DotField outline={outline} view={view} />)
    tick(1)
    Object.assign(view, { value: { width: 804, height: 874 } })
    tick(1.1)
    expect(dotsDrawn()).toBe(24 * 26)
  })
})
