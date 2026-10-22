import { render, screen } from '@testing-library/react-native'
import { ScreenShowLayout, type ScreenEvents } from '@/theme/decorations/ScreenShow'
import type { Theme, ThemeName } from '@/theme/theme.types'
import { THEMES } from '@/theme/themes/registry'
import { ThemeDecoration } from './ThemeDecoration'

function inTheme(theme: Theme) {
  const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
  return jest.spyOn(unistyles, 'useUnistyles').mockReturnValue({ theme, rt: unistyles.UnistylesRuntime } as never)
}

afterEach(() => jest.restoreAllMocks())

describe.each(['cobalt', 'forest', 'bordeaux'] as const satisfies readonly ThemeName[])('%s', (name) => {
  const theme = THEMES[name]

  it('draws the wavy lines on the panel edge', () => {
    inTheme(theme)
    render(<ThemeDecoration slot="panelEdge" />)
    expect(screen.getByTestId('decoration-opart-waves')).toBeTruthy()
    expect(screen.getByTestId('skia-path').props.color).toBe(theme.colors.lineStrong)
  })

  it('draws a short wavy rule of two lines for a section heading, in the strong line colour', () => {
    inTheme(theme)
    render(<ThemeDecoration slot="sectionRule" />)
    expect(screen.getByTestId('decoration-opart-section-rule')).toBeTruthy()
    expect(screen.getByTestId('skia-path').props.color).toBe(theme.colors.lineStrong)
  })

  it('draws the wavy lines across the finish card, in the card text colour', () => {
    inTheme(theme)
    render(<ThemeDecoration slot="cardEdge" style={{ marginTop: -11 }} />)
    expect(screen.getByTestId('decoration-opart-card-waves').props.style).toMatchObject({
      width: theme.size.card.width,
    })
    expect(screen.getByTestId('skia-path').props.color).toBe(theme.components.finishCard.text)
  })

  it('draws the wavy lines on the summary edge, as wide as the content column', () => {
    inTheme(theme)
    render(<ThemeDecoration slot="summaryEdge" />)
    expect(screen.getByTestId('decoration-opart-summary-waves')).toBeTruthy()
    expect(screen.getByTestId('skia-path').props.color).toBe(theme.components.summary.border)
  })
})

it('redraws the wavy lines when their screen starts to show again', () => {
  inTheme(THEMES.cobalt)
  const { canvasRedraw } = jest.requireMock<{ canvasRedraw: jest.Mock }>('@shopify/react-native-skia')
  canvasRedraw.mockClear()
  const listeners: Parameters<ScreenEvents['addListener']>[1][] = []
  const navigation: ScreenEvents = {
    addListener: (_type, listener) => {
      listeners.push(listener)
      return () => {}
    },
  }
  render(
    <ScreenShowLayout navigation={navigation}>
      <ThemeDecoration slot="summaryEdge" />
    </ScreenShowLayout>,
  )
  listeners.forEach((listener) => listener({ data: { closing: false } }))
  expect(canvasRedraw).toHaveBeenCalledWith('decoration-opart-summary-waves')
})
