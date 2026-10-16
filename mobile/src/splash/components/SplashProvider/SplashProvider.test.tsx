import { act, render, screen } from '@testing-library/react-native'
import * as SplashScreen from 'expo-splash-screen'
import { Text } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { EXIT_END_MS, INTRO_END_MS, MAX_WAIT_MS } from '@/splash/constants/splash.constants'
import { useSplash, useSplashReady } from '@/splash/hooks/useSplash'
import { SplashProvider } from './SplashProvider'

function Probe({ ready }: { ready: boolean }) {
  useSplashReady(ready)
  return <Text testID="phase">{useSplash().phase}</Text>
}

const phase = () => screen.getByTestId('phase').props.children
const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms)
  })

beforeEach(() => {
  jest.useFakeTimers()
  jest.mocked(useReducedMotion).mockReturnValue(false)
  jest.mocked(SplashScreen.hide).mockClear()
})

afterEach(() => {
  jest.useRealTimers()
})

it('stays in the intro after the intro is done while the home is not ready', () => {
  render(
    <SplashProvider>
      <Probe ready={false} />
    </SplashProvider>,
  )
  advance(INTRO_END_MS + 10)
  expect(phase()).toBe('intro')
})

it('starts the exit when the intro is done and the home is ready', () => {
  render(
    <SplashProvider>
      <Probe ready />
    </SplashProvider>,
  )
  advance(INTRO_END_MS - 1)
  expect(phase()).toBe('intro')
  advance(1)
  expect(phase()).toBe('exit')
})

it('starts the exit after the time limit when no screen is ready', () => {
  render(
    <SplashProvider>
      <Probe ready={false} />
    </SplashProvider>,
  )
  advance(MAX_WAIT_MS - 1)
  expect(phase()).toBe('intro')
  advance(1)
  expect(phase()).toBe('exit')
})

it('is done when the exit ends', () => {
  render(
    <SplashProvider>
      <Probe ready />
    </SplashProvider>,
  )
  advance(INTRO_END_MS)
  expect(phase()).toBe('exit')
  advance(EXIT_END_MS)
  expect(phase()).toBe('done')
})

it('with Reduce Motion, is done at once and hides the native splash when the home is ready', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  const { rerender } = render(
    <SplashProvider>
      <Probe ready={false} />
    </SplashProvider>,
  )
  expect(phase()).toBe('done')
  expect(SplashScreen.hide).not.toHaveBeenCalled()
  rerender(
    <SplashProvider>
      <Probe ready />
    </SplashProvider>,
  )
  expect(SplashScreen.hide).toHaveBeenCalledTimes(1)
})
