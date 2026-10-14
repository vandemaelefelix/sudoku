import { act, fireEvent, render, screen } from '@testing-library/react-native'
import * as SplashScreen from 'expo-splash-screen'
import { SplashContext, type SplashPhase } from '@/splash/hooks/useSplash'
import { SplashOverlay } from './SplashOverlay'

function renderIn(phase: SplashPhase) {
  return render(
    <SplashContext value={{ phase, markReady: jest.fn() }}>
      <SplashOverlay />
    </SplashContext>,
  )
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.mocked(SplashScreen.hide).mockClear()
})

afterEach(() => {
  jest.useRealTimers()
})

it('draws nothing when the splash is done', () => {
  renderIn('done')
  expect(screen.queryByTestId('splash-overlay')).toBeNull()
})

it('draws the ground, the cells and the word during the intro', () => {
  renderIn('intro')
  expect(screen.getByTestId('splash-overlay')).toBeTruthy()
  expect(screen.getByTestId('skia-canvas')).toBeTruthy()
  expect(screen.getByTestId('splash-word')).toBeTruthy()
})

it('passes every touch to the screen below', () => {
  renderIn('exit')
  expect(screen.getByTestId('splash-overlay').props.pointerEvents).toBe('none')
})

it('hides the native splash once, after the first layout', () => {
  renderIn('intro')
  const overlay = screen.getByTestId('splash-overlay')
  fireEvent(overlay, 'layout')
  fireEvent(overlay, 'layout')
  act(() => {
    jest.runAllTimers()
  })
  expect(SplashScreen.hide).toHaveBeenCalledTimes(1)
})
