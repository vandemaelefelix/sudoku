import { createPicture, Skia } from '@shopify/react-native-skia'
import { render, screen } from '@testing-library/react-native'
import { type SharedValue, useFrameCallback, useReducedMotion } from 'react-native-reanimated'
import type { Quad } from '../../scanner'
import type { ViewSize } from '../previewMapping'
import { EffectCanvas } from './EffectCanvas'
import { DEFAULT_INDEX, effectIndex } from './index'

// Test effects stand in for the registry, so removing a real effect cannot break these tests.
jest.mock('./index', () => {
  const alpha = {
    id: 'alpha',
    name: 'Alpha',
    family: 'simulation',
    create: (scene: { width: number }) => ({ width: scene.width, x: 0 }),
    step: (state: { width: number; x: number }, scene: { dt: number; reduceMotion: boolean }) => ({
      ...state,
      x: scene.reduceMotion ? state.x : state.x + scene.dt,
    }),
    draw: (canvas: { drawAtlas: (...args: unknown[]) => void }, state: { width: number; x: number }) => {
      'worklet'
      canvas.drawAtlas(null, null, [state.width, state.x])
    },
  }
  const beta = {
    id: 'beta',
    name: 'Beta',
    family: 'path',
    create: () => ({}),
    step: (state: unknown) => state,
    draw: (canvas: { drawPath: (...args: unknown[]) => void }) => {
      'worklet'
      canvas.drawPath()
    },
  }
  const gamma = {
    id: 'gamma',
    name: 'Gamma',
    family: 'shader',
    sksl: 'half4 main(float2 p) { return half4(1); }',
    create: () => ({}),
    step: (state: unknown) => state,
    draw: (canvas: { drawRect: (...args: unknown[]) => void }, _state: unknown, _scene: unknown, kit: { shaders: { [id: string]: unknown } }) => {
      'worklet'
      if (kit.shaders.gamma != null) canvas.drawRect()
    },
  }
  const EFFECTS = [alpha, beta, gamma]
  return {
    EFFECTS,
    DEFAULT_INDEX: 0,
    DEFAULT_EFFECT: alpha,
    effectAt: (index: number) => {
      'worklet'
      return Number.isInteger(index) && index >= 0 && index < EFFECTS.length ? EFFECTS[index] : alpha
    },
    effectIndex: (id: string | null) => Math.max(0, EFFECTS.findIndex((effect) => effect.id === id)),
  }
})

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

  it('draws the default effect after the first frame', () => {
    renderCanvas(VIEW)
    tick(1)
    expect(lastFrame().drawAtlas.mock.calls[0][2][0]).toBe(402)
  })

  it('rebuilds the effect when the view size changes', () => {
    const props = renderCanvas(VIEW)
    tick(1)
    Object.assign(props.view, { value: { width: 804, height: 874 } })
    tick(1.1)
    expect(lastFrame().drawAtlas.mock.calls[0][2][0]).toBe(804)
  })

  it('runs the default effect for an index out of range', () => {
    renderCanvas(VIEW, 99)
    tick(1)
    expect(lastFrame().drawAtlas).toHaveBeenCalledTimes(1)
  })

  it('keeps the default effect state when an invalid index falls back to it', () => {
    const props = renderCanvas(VIEW, 99)
    tick(1)
    tick(1 + 1 / 60)
    Object.assign(props.effect, { value: DEFAULT_INDEX })
    tick(1 + 2 / 60)
    expect(lastFrame().drawAtlas.mock.calls[0][2][1]).toBeGreaterThan(0.03)
  })

  it('passes Reduce Motion to the effect', () => {
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
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\[fx\] alpha \d+\.\d fps, overlay \d+\.\d\d ms$/))
    log.mockRestore()
  })

  it('switches to another effect on the next frame and draws nothing of the old one', () => {
    const props = renderCanvas(VIEW, DEFAULT_INDEX, grid)
    tick(1)
    expect(lastFrame().drawAtlas).toHaveBeenCalledTimes(1)
    Object.assign(props.effect, { value: effectIndex('beta') })
    tick(1 + 1 / 60)
    const canvas = lastFrame()
    expect(canvas.drawAtlas).not.toHaveBeenCalled()
    expect(canvas.drawPath).toHaveBeenCalledTimes(1)
  })

  it('gives an effect with a runtime shader its compiled shader', () => {
    renderCanvas(VIEW, effectIndex('gamma'), grid)
    tick(1)
    expect(lastFrame().drawRect).toHaveBeenCalledTimes(1)
  })

  it('draws nothing for an effect whose shader did not compile, and logs the error', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.mocked(Skia.RuntimeEffect.Make).mockImplementationOnce(() => {
      throw new Error('Error in sksl: bad')
    })
    renderCanvas(VIEW, effectIndex('gamma'), grid)
    tick(1)
    tick(1 + 1 / 60)
    expect(lastFrame().drawRect).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith('[fx] gamma shader failed: Error in sksl: bad')
    log.mockRestore()
  })

  describe('in a release build', () => {
    const dev = __DEV__
    beforeEach(() => Object.assign(globalThis, { __DEV__: false }))
    afterEach(() => Object.assign(globalThis, { __DEV__: dev }))

    it('compiles no runtime shader', () => {
      renderCanvas(VIEW)
      expect(Skia.RuntimeEffect.Make).not.toHaveBeenCalled()
    })
  })
})
