import { render, screen } from '@testing-library/react-native'
import type { Theme } from '@/theme/theme.types'
import { THEMES } from '@/theme/themes/registry'
import { ThemeDecoration } from './ThemeDecoration'

function inTheme(theme: Theme) {
  const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
  return jest.spyOn(unistyles, 'useUnistyles').mockReturnValue({ theme, rt: unistyles.UnistylesRuntime } as never)
}

afterEach(() => jest.restoreAllMocks())

it.each(['daylight', 'midnight'] as const)('draws nothing in %s', (name) => {
  inTheme(THEMES[name])
  render(<ThemeDecoration slot="panelEdge" />)
  render(<ThemeDecoration slot="titleMark" />)
  render(<ThemeDecoration slot="cardEdge" style={{ margin: -10 }} />)
  expect(screen.toJSON()).toBeNull()
})

it('draws the wavy lines on the Op-art panel edge, and no title mark', () => {
  inTheme(THEMES.opart)
  render(<ThemeDecoration slot="panelEdge" />)
  expect(screen.getByTestId('decoration-opart-waves')).toBeTruthy()
  expect(screen.getByTestId('skia-path').props.color).toBe(THEMES.opart.colors.lineStrong)
})

it('draws the wavy lines across the Op-art finish card, in the card text colour', () => {
  inTheme(THEMES.opart)
  render(<ThemeDecoration slot="cardEdge" style={{ marginTop: -11 }} />)
  expect(screen.getByTestId('decoration-opart-card-waves').props.style).toMatchObject({
    width: THEMES.opart.size.card.width,
  })
  expect(screen.getByTestId('skia-path').props.color).toBe(THEMES.opart.components.finishCard.text)
})

it('draws the stripes and the disc in Progressive', () => {
  inTheme(THEMES.progressive)
  render(
    <>
      <ThemeDecoration slot="panelEdge" />
      <ThemeDecoration slot="titleMark" />
    </>,
  )
  expect(screen.getByTestId('decoration-progressive-stripes')).toBeTruthy()
  expect(screen.getByTestId('decoration-progressive-disc')).toBeTruthy()
})
