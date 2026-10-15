import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { SplashCells } from '@/splash/components/SplashCells'
import { SplashWord } from '@/splash/components/SplashWord'
import { SplashContext } from '@/splash/hooks/useSplash'
import { SPLASH_GROUND } from '@/theme/splash.colors'
import { bordeaux, bordeauxColour } from '@/theme/themes/bordeaux'
import { SplashOverlay } from './SplashOverlay'

jest.mock('@/splash/components/SplashCells', () => ({ SplashCells: jest.fn(() => null) }))
jest.mock('@/splash/components/SplashWord', () => ({ SplashWord: jest.fn(() => null) }))

const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')

afterEach(() => jest.restoreAllMocks())

function overlayIn(theme: typeof bordeaux) {
  jest.spyOn(unistyles, 'useUnistyles').mockReturnValue({ theme, rt: unistyles.UnistylesRuntime } as never)
  jest.mocked(SplashCells).mockClear()
  jest.mocked(SplashWord).mockClear()
  render(
    <SplashContext value={{ phase: 'intro', markReady: jest.fn() }}>
      <SplashOverlay />
    </SplashContext>,
  )
}

// The native splash is white for every look, so the first frame of the overlay is white too. The ground then fades to the
// page colour of the saved look, and the word and the cells use the colours of that look (ADR-026).
it.each([
  ['Light', bordeaux],
  ['Colour', bordeauxColour],
])('starts on the white of the native splash in the %s look', (_look, theme) => {
  overlayIn(theme)
  const first = screen.getByTestId('splash-overlay').children[0] as unknown as { props: { style: unknown } }
  expect(StyleSheet.flatten(first.props.style as never)).toMatchObject({ backgroundColor: SPLASH_GROUND })
})

it.each([
  ['Light', bordeaux],
  ['Colour', bordeauxColour],
])('draws the ground, the cells and the word in the colours of the saved %s look', (_look, theme) => {
  overlayIn(theme)
  expect(jest.mocked(SplashCells).mock.calls[0]?.[0]).toMatchObject({
    ground: theme.colors.background,
    tint: theme.colors.accent,
    line: theme.colors.line,
  })
  expect(jest.mocked(SplashWord).mock.calls[0]?.[0]).toMatchObject({ color: theme.colors.text })
})

it('behaves in Light as before: the page colour is the white of the native splash', () => {
  expect(bordeaux.colors.background).toBe(SPLASH_GROUND)
})

it('uses a page colour in Colour that differs from the white of the native splash, so the fade shows', () => {
  expect(bordeauxColour.colors.background).not.toBe(SPLASH_GROUND)
  expect(bordeauxColour.colors.text).toBe(bordeauxColour.colors.accent)
})

it('fades the ground in an animated layer around the cells', () => {
  overlayIn(bordeauxColour)
  expect(screen.getByTestId('splash-overlay').children).toHaveLength(3)
})
