import { makeImageFromView } from '@shopify/react-native-skia'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { useEffect } from 'react'
import { Text } from 'react-native'
import * as reanimated from 'react-native-reanimated'
import { useReducedMotion } from 'react-native-reanimated'
import { TRANSITION_MS } from './transition.constants'
import { ThemeTransitionProvider } from './ThemeTransitionProvider'
import { useThemeTransition, type ThemeTransition } from './useThemeTransition'

const api: { start: ThemeTransition['start'] } = { start: () => false }
const start: ThemeTransition['start'] = (theme, apply) => api.start(theme, apply)
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
  let accepted = false
  await act(async () => {
    accepted = start({ name, appearance: 'light' }, apply)
  })
  return accepted
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

it('accepts a new switch after a failed picture', async () => {
  snapshot.mockRejectedValueOnce(new Error('Invalid view tag'))
  renderProvider()
  await begin(jest.fn())
  expect(await begin(jest.fn(), 'bordeaux')).toBe(true)
})

it('ignores a second switch while the picture is taken and while the wave runs, and accepts one after it', async () => {
  const first = jest.fn()
  const second = jest.fn()
  renderProvider()
  let accepted = true
  act(() => {
    start({ name: 'forest', appearance: 'light' }, first)
    accepted = start({ name: 'bordeaux', appearance: 'colour' }, second)
  })
  expect(accepted).toBe(false)
  await act(async () => {})
  accepted = true
  act(() => {
    accepted = start({ name: 'bordeaux', appearance: 'colour' }, second)
  })
  expect(accepted).toBe(false)
  layOut()
  act(() => {
    endWave?.(true)
    jest.runAllTicks()
  })
  expect(second).not.toHaveBeenCalled()
  expect(await begin(second, 'bordeaux')).toBe(true)
})

it('switches at once, with no picture and no overlay, with Reduce Motion', async () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const apply = jest.fn()
  renderProvider()
  expect(await begin(apply)).toBe(true)
  expect(apply).toHaveBeenCalledTimes(1)
  expect(snapshot).not.toHaveBeenCalled()
  expect(screen.queryByTestId('theme-cell-wave')).toBeNull()
})
