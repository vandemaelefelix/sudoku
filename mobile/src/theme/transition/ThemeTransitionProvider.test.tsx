import { makeImageFromView } from '@shopify/react-native-skia'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { useEffect } from 'react'
import { Text } from 'react-native'
import * as reanimated from 'react-native-reanimated'
import { useReducedMotion } from 'react-native-reanimated'
import { UnistylesRuntime } from 'react-native-unistyles'
import { TRANSITION_MS } from './transition.constants'
import { ThemeTransitionProvider } from './ThemeTransitionProvider'
import { useThemeTransition, type ThemeTransition } from './useThemeTransition'

const api: { start: ThemeTransition['start'] } = { start: () => undefined }
const start: ThemeTransition['start'] = (theme, apply, settleMs) => api.start(theme, apply, settleMs)
function Probe() {
  const transition = useThemeTransition()
  useEffect(() => {
    api.start = transition.start
  }, [transition])
  return <Text>screen</Text>
}

const image = { width: () => 780, height: () => 1688, dispose: jest.fn() }
const snapshot = jest.mocked(makeImageFromView)

// The end of the timing runs on the UI thread. The test calls it by hand.
let endWave: ((finished?: boolean) => void) | undefined

beforeEach(() => {
  jest.useFakeTimers()
  jest.mocked(useReducedMotion).mockReturnValue(false)
  snapshot.mockReset()
  snapshot.mockResolvedValue(image as never)
  image.dispose.mockClear()
  endWave = undefined
  jest.spyOn(reanimated, 'withTiming').mockImplementation((toValue, _config, callback) => {
    endWave = callback
    return toValue
  })
  jest.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

function renderProvider() {
  return render(
    <ThemeTransitionProvider>
      <Probe />
    </ThemeTransitionProvider>,
  )
}

async function begin(apply: () => void, name: 'forest' | 'bordeaux' = 'forest') {
  await act(async () => {
    start({ name, appearance: 'light' }, apply)
  })
}

function endTheWave() {
  act(() => {
    endWave?.(true)
    jest.runAllTicks()
  })
}

/** The first layout of the overlay means its picture is on screen. The switch waits one more frame. */
function layOut() {
  fireEvent(screen.getByTestId('theme-cell-wave'), 'layout')
  act(() => {
    jest.runAllTimers()
  })
}

it('draws no overlay until a switch starts', () => {
  renderProvider()
  expect(screen.queryByTestId('theme-cell-wave')).toBeNull()
})

it('takes a picture of the app, and draws it over the screen without taking a touch', async () => {
  renderProvider()
  await begin(jest.fn())
  expect(snapshot).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId('theme-cell-wave').props.pointerEvents).toBe('none')
  expect(screen.getByText('screen')).toBeTruthy()
})

it('switches the theme once, after the overlay has laid out, not before', async () => {
  const apply = jest.fn()
  renderProvider()
  await begin(apply)
  expect(apply).not.toHaveBeenCalled()
  layOut()
  expect(apply).toHaveBeenCalledTimes(1)
  layOut()
  expect(apply).toHaveBeenCalledTimes(1)
})

it('starts the clock of the wave when the theme switches, over TRANSITION_MS in linear time', async () => {
  renderProvider()
  await begin(jest.fn())
  expect(reanimated.withTiming).not.toHaveBeenCalled()
  layOut()
  expect(reanimated.withTiming).toHaveBeenCalledTimes(1)
  expect(reanimated.withTiming).toHaveBeenCalledWith(
    TRANSITION_MS,
    expect.objectContaining({ duration: TRANSITION_MS, reduceMotion: reanimated.ReduceMotion.Never }),
    expect.any(Function),
  )
})

it('removes the overlay first and frees the picture after it, never while the overlay can draw it', async () => {
  renderProvider()
  await begin(jest.fn())
  layOut()
  expect(image.dispose).not.toHaveBeenCalled()
  act(() => {
    endWave?.(true)
    jest.runAllTicks()
  })
  expect(screen.queryByTestId('theme-cell-wave')).toBeNull()
  expect(image.dispose).not.toHaveBeenCalled()
  act(() => {
    jest.runAllTimers()
  })
  expect(image.dispose).toHaveBeenCalledTimes(1)
})

it('frees the picture once, also when the provider goes away during the wave', async () => {
  const view = renderProvider()
  await begin(jest.fn())
  layOut()
  view.unmount()
  act(() => {
    jest.runAllTimers()
  })
  expect(image.dispose).toHaveBeenCalledTimes(1)
})

it('switches at once, with no overlay, when the picture is empty', async () => {
  snapshot.mockResolvedValue(null as never)
  const apply = jest.fn()
  renderProvider()
  await begin(apply)
  expect(apply).toHaveBeenCalledTimes(1)
  expect(screen.queryByTestId('theme-cell-wave')).toBeNull()
})

it('switches at once, with no overlay, when the picture fails', async () => {
  snapshot.mockRejectedValue(new Error('Invalid view tag'))
  const apply = jest.fn()
  renderProvider()
  await begin(apply)
  expect(apply).toHaveBeenCalledTimes(1)
  expect(screen.queryByTestId('theme-cell-wave')).toBeNull()
})

it('takes a new picture for a switch after a failed picture', async () => {
  snapshot.mockRejectedValueOnce(new Error('Invalid view tag'))
  renderProvider()
  await begin(jest.fn())
  await begin(jest.fn(), 'bordeaux')
  expect(snapshot).toHaveBeenCalledTimes(2)
})

it('keeps only the last switch made during a wave, and plays it when the wave ends', async () => {
  const first = jest.fn()
  const replaced = jest.fn()
  const last = jest.fn()
  renderProvider()
  await begin(first)
  layOut()
  act(() => {
    start({ name: 'bordeaux', appearance: 'colour' }, replaced)
    start({ name: 'bordeaux', appearance: 'light' }, last)
  })
  expect(snapshot).toHaveBeenCalledTimes(1)
  await act(async () => endTheWave())
  expect(snapshot).toHaveBeenCalledTimes(2)
  layOut()
  expect(last).toHaveBeenCalledTimes(1)
  expect(replaced).not.toHaveBeenCalled()
})

it('keeps a switch made while the picture is taken', async () => {
  const second = jest.fn()
  renderProvider()
  act(() => {
    start({ name: 'forest', appearance: 'light' }, jest.fn())
    start({ name: 'bordeaux', appearance: 'colour' }, second)
  })
  await act(async () => {})
  layOut()
  await act(async () => endTheWave())
  layOut()
  expect(second).toHaveBeenCalledTimes(1)
})

describe('with the look of the target on screen', () => {
  beforeEach(() => Object.defineProperty(UnistylesRuntime, 'themeName', { value: 'forest', configurable: true }))
  afterEach(() => Object.defineProperty(UnistylesRuntime, 'themeName', { value: undefined, configurable: true }))

  it('applies the switch at once, with no wave', () => {
    const apply = jest.fn()
    renderProvider()
    act(() => start({ name: 'forest', appearance: 'light' }, apply))
    expect(apply).toHaveBeenCalledTimes(1)
    expect(snapshot).not.toHaveBeenCalled()
  })

  it('applies a waiting switch back to that look with no second wave', async () => {
    const back = jest.fn()
    renderProvider()
    await begin(jest.fn(), 'bordeaux')
    layOut()
    act(() => start({ name: 'forest', appearance: 'light' }, back))
    await act(async () => endTheWave())
    expect(back).toHaveBeenCalledTimes(1)
    expect(snapshot).toHaveBeenCalledTimes(1)
  })
})

it('takes the picture only after the settle time, and keeps a switch made while it waits', async () => {
  const second = jest.fn()
  renderProvider()
  act(() => {
    start({ name: 'forest', appearance: 'light' }, jest.fn(), 160)
  })
  act(() => {
    jest.advanceTimersByTime(159)
  })
  expect(snapshot).not.toHaveBeenCalled()
  act(() => {
    start({ name: 'bordeaux', appearance: 'light' }, second, 160)
  })
  await act(async () => {
    jest.advanceTimersByTime(1)
  })
  expect(snapshot).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId('theme-cell-wave')).toBeTruthy()
  layOut()
  await act(async () => endTheWave())
  // The waiting switch keeps the rest of its settle time.
  await act(async () => {
    jest.runAllTimers()
  })
  expect(snapshot).toHaveBeenCalledTimes(2)
})

it('switches at once, with no picture and no overlay, with Reduce Motion', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const apply = jest.fn()
  renderProvider()
  act(() => start({ name: 'forest', appearance: 'light' }, apply, 160))
  expect(apply).toHaveBeenCalledTimes(1)
  expect(snapshot).not.toHaveBeenCalled()
  expect(screen.queryByTestId('theme-cell-wave')).toBeNull()
})
