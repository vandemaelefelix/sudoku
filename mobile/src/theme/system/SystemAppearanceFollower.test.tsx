import { act, render } from '@testing-library/react-native'
import { AppState, Appearance } from 'react-native'
import { cobalt } from '@/theme/themes/cobalt'
import { forestColour } from '@/theme/themes/forest'
import { resetThemeSession, setSessionAppearancePreference, setSessionThemePreference } from '@/theme/session'
import { ThemeTransitionContext } from '@/theme/transition/useThemeTransition'
import { SystemAppearanceFollower } from './SystemAppearanceFollower'

const appState = AppState as { currentState: string }
const realState = appState.currentState
const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
let listener: (() => void) | undefined
let scheme: 'light' | 'dark' = 'light'
const start = jest.fn<boolean, [{ name: string; appearance: string }, () => void]>(() => true)
const setTheme = jest.fn()

function show(theme: typeof cobalt) {
  jest.spyOn(unistyles, 'useUnistyles').mockReturnValue({ theme, rt: unistyles.UnistylesRuntime } as never)
}

function renderFollower() {
  return render(
    <ThemeTransitionContext value={{ start }}>
      <SystemAppearanceFollower />
    </ThemeTransitionContext>,
  )
}

/** The iOS setting changes: React Native tells every listener. */
function changeSystem(next: 'light' | 'dark') {
  scheme = next
  act(() => listener?.())
}

beforeEach(() => {
  scheme = 'light'
  listener = undefined
  start.mockClear()
  setTheme.mockClear()
  resetThemeSession()
  jest.spyOn(Appearance, 'getColorScheme').mockImplementation(() => scheme)
  jest.spyOn(Appearance, 'addChangeListener').mockImplementation((callback) => {
    listener = () => callback({ colorScheme: scheme })
    return { remove: jest.fn() }
  })
  jest.spyOn(unistyles.UnistylesRuntime, 'setTheme').mockImplementation(setTheme)
  appState.currentState = 'active'
  show(cobalt)
})

afterEach(() => {
  jest.restoreAllMocks()
  appState.currentState = realState
})

it('does nothing at startup: the first frame already has the look of the system', () => {
  setSessionAppearancePreference('auto')
  renderFollower()
  expect(start).not.toHaveBeenCalled()
})

it('plays the wave to Colour when the system turns dark while the appearance is Auto', () => {
  setSessionAppearancePreference('auto')
  setSessionThemePreference('forest')
  show({ ...cobalt, name: 'forest', appearance: 'light' })
  renderFollower()
  changeSystem('dark')
  expect(start).toHaveBeenCalledTimes(1)
  expect(start.mock.calls[0]?.[0]).toEqual({ name: 'forest', appearance: 'colour' })
  start.mock.calls[0]?.[1]()
  expect(setTheme).toHaveBeenCalledWith('forest-colour')
})

it('plays the wave back to Light when the system turns light again', () => {
  setSessionAppearancePreference('auto')
  setSessionThemePreference('forest')
  scheme = 'dark'
  show(forestColour)
  renderFollower()
  expect(start).not.toHaveBeenCalled()
  changeSystem('light')
  expect(start.mock.calls[0]?.[0]).toEqual({ name: 'forest', appearance: 'light' })
})

it.each(['light', 'colour'] as const)('ignores the system when the appearance is %s', (appearance) => {
  setSessionAppearancePreference(appearance)
  renderFollower()
  changeSystem('dark')
  expect(start).not.toHaveBeenCalled()
})

it('switches at once, with no wave, when the app is not in the foreground', () => {
  appState.currentState = 'background'
  setSessionAppearancePreference('auto')
  renderFollower()
  changeSystem('dark')
  expect(start).not.toHaveBeenCalled()
  expect(setTheme).toHaveBeenCalledWith('cobalt-colour')
})
