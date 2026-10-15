import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import Storage from 'expo-sqlite/kv-store'
import { ScrollView, StyleSheet } from 'react-native'
import { ASSISTS_KEY, DEFAULT_ASSISTS, type AssistName } from '@/game/constants/assists.constants'
import { useAssists } from '@/game/hooks/useAssists'
import { HAPTICS_KEY } from '@/settings/constants/haptics.constants'
import { useHaptics } from '@/settings/hooks/useHaptics'
import { APPEARANCE_PREFERENCE_KEY, THEME_PREFERENCE_KEY } from '@/theme/preference'
import { resetThemeSession } from '@/theme/session'
import { cobalt, cobaltColour } from '@/theme/themes/cobalt'
import { SettingsScreen } from './SettingsScreen'

const LABELS = ['Row and column', 'Box', 'Selected cell', 'Same numbers']

// The store is one module value for the whole test file, so each test turns every assist on again.
afterEach(async () => {
  const { result, unmount } = renderHook(() => useAssists())
  const names = Object.keys(DEFAULT_ASSISTS) as AssistName[]
  await act(async () => {
    names.forEach((name) => result.current.setAssist(name, true))
  })
  unmount()
  resetThemeSession()
  await Storage.setItemAsync(THEME_PREFERENCE_KEY, 'cobalt')
  await Storage.setItemAsync(APPEARANCE_PREFERENCE_KEY, 'light')
})

it('lists the four assists in the canvas order, all on by default', () => {
  render(<SettingsScreen onBack={jest.fn()} />)
  const labels = screen.getAllByText(/^(Row and column|Box|Selected cell|Same numbers)$/, {
    includeHiddenElements: true,
  })
  expect(labels.map((label) => label.props.children)).toEqual(LABELS)
  for (const label of LABELS)
    expect(screen.getByLabelText(label).props.accessibilityState).toMatchObject({ checked: true })
})

it('turns an assist off and saves it', async () => {
  render(<SettingsScreen onBack={jest.fn()} />)
  await act(async () => fireEvent.press(screen.getByLabelText('Box')))
  expect(screen.getByLabelText('Box').props.accessibilityState).toMatchObject({ checked: false })
  expect(Storage.setItemAsync).toHaveBeenLastCalledWith(ASSISTS_KEY, JSON.stringify({ ...DEFAULT_ASSISTS, box: false }))
})

it('saves the theme choice', async () => {
  render(<SettingsScreen onBack={jest.fn()} />)
  expect(screen.getByRole('button', { name: 'Cobalt', selected: true })).toBeTruthy()
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Forest' })))
  expect(screen.getByRole('button', { name: 'Forest', selected: true })).toBeTruthy()
  expect(Storage.setItemAsync).toHaveBeenLastCalledWith(THEME_PREFERENCE_KEY, 'forest')
})

it('shows the appearance under the theme, Light by default, and saves a new choice', async () => {
  render(<SettingsScreen onBack={jest.fn()} />)
  expect(screen.getByText('Appearance')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Light', selected: true })).toBeTruthy()
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Colour' })))
  expect(screen.getByRole('button', { name: 'Colour', selected: true })).toBeTruthy()
  expect(Storage.setItemAsync).toHaveBeenLastCalledWith(APPEARANCE_PREFERENCE_KEY, 'colour')
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Auto' })))
  expect(Storage.setItemAsync).toHaveBeenLastCalledWith(APPEARANCE_PREFERENCE_KEY, 'auto')
})

it('has a back button of 44 pt that calls onBack', () => {
  const onBack = jest.fn()
  render(<SettingsScreen onBack={onBack} />)
  const back = screen.getByRole('button', { name: 'Back' })
  fireEvent.press(back)
  expect(onBack).toHaveBeenCalled()
  expect(StyleSheet.flatten(back.props.style)).toMatchObject({ width: 44, height: 44 })
})

it('shows the headings and the hint of the canvas', () => {
  render(<SettingsScreen onBack={jest.fn()} />)
  expect(screen.getByText('Settings')).toBeTruthy()
  expect(screen.getByText('Assists')).toBeTruthy()
  expect(screen.getByText('Turn these off for a raw game.')).toBeTruthy()
  expect(screen.getByText('Theme')).toBeTruthy()
})

it('shows a switch in the preview at once', async () => {
  render(<SettingsScreen onBack={jest.fn()} />)
  await act(async () => fireEvent.press(screen.getByLabelText('Box')))
  // Cell 31 is in the box of cell 39, not in its row or column, and holds no 8.
  const cell31 = screen.getByTestId('cell-31', { includeHiddenElements: true })
  expect(StyleSheet.flatten(cell31.props.style).backgroundColor).toBe(cobalt.components.cell.fill)
})

describe('the haptics switch', () => {
  afterEach(async () => {
    const { result, unmount } = renderHook(() => useHaptics())
    await act(async () => result.current.setOn(true))
    unmount()
  })

  it('is on by default, and turning it off saves the switch and plays no tick', async () => {
    render(<SettingsScreen onBack={jest.fn()} />)
    const row = screen.getByLabelText('Haptics')
    expect(row.props.accessibilityState).toMatchObject({ checked: true })
    jest.mocked(Haptics.selectionAsync).mockClear()
    await act(async () => fireEvent.press(row))
    expect(Storage.setItemAsync).toHaveBeenLastCalledWith(HAPTICS_KEY, 'off')
    expect(Haptics.selectionAsync).not.toHaveBeenCalled()
  })

  it('ticks for an assist switch and a theme choice', async () => {
    render(<SettingsScreen onBack={jest.fn()} />)
    jest.mocked(Haptics.selectionAsync).mockClear()
    await act(async () => fireEvent.press(screen.getByLabelText('Box')))
    fireEvent.press(screen.getByRole('button', { name: 'Forest' }))
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2)
  })
})

it('draws the scroll bars in the colour of the theme, so they show on a dark Colour page', () => {
  const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
  const view = render(<SettingsScreen onBack={jest.fn()} />)
  expect(view.UNSAFE_getByType(ScrollView).props.indicatorStyle).toBe(cobalt.scrollIndicator)
  view.unmount()
  jest
    .spyOn(unistyles, 'useUnistyles')
    .mockReturnValue({ theme: cobaltColour, rt: unistyles.UnistylesRuntime } as never)
  const colour = render(<SettingsScreen onBack={jest.fn()} />)
  expect(colour.UNSAFE_getByType(ScrollView).props.indicatorStyle).toBe(cobaltColour.scrollIndicator)
  jest.restoreAllMocks()
})

describe('the Op-art look of the page (ADR-026)', () => {
  it('puts a short wavy rule under each of the four headings', () => {
    render(<SettingsScreen onBack={jest.fn()} />)
    expect(screen.getAllByTestId('decoration-opart-section-rule')).toHaveLength(4)
  })

  it('draws the assists in one framed block with square corners and the border of the stats card', () => {
    render(<SettingsScreen onBack={jest.fn()} />)
    const style = StyleSheet.flatten(screen.getByTestId('assist-card').props.style)
    expect(style).toMatchObject({
      borderRadius: cobalt.components.summary.radius,
      borderWidth: cobalt.components.summary.borderWidth,
      borderColor: cobalt.components.summary.border,
    })
    expect(cobalt.components.summary.radius).toBe(0)
  })

  it('divides the rows by the strong rule of the box-line weight', () => {
    render(<SettingsScreen onBack={jest.fn()} />)
    const second = screen.getByTestId('assist-row-Box')
    expect(StyleSheet.flatten(second.props.style)).toMatchObject({
      borderTopWidth: cobalt.components.summary.ruleWidth,
      borderTopColor: cobalt.components.summary.rule,
    })
  })
})
