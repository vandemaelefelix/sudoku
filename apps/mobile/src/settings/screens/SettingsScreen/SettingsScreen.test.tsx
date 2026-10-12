import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native'
import Storage from 'expo-sqlite/kv-store'
import { StyleSheet } from 'react-native'
import { ASSISTS_KEY, DEFAULT_ASSISTS, type AssistName } from '@/game/constants/assists.constants'
import { useAssists } from '@/game/hooks/useAssists'
import { useThemePreference } from '@/settings/hooks/useThemePreference'
import { THEME_PREFERENCE_KEY } from '@/theme/preference'
import { daylight } from '@/theme/themes/daylight'
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
  const theme = renderHook(() => useThemePreference())
  await act(async () => theme.result.current.choose('system'))
  theme.unmount()
  await Storage.setItemAsync(THEME_PREFERENCE_KEY, 'system')
})

it('lists the four assists in the canvas order, all on by default', () => {
  render(<SettingsScreen onBack={jest.fn()} />)
  const labels = screen.getAllByText(/^(Row and column|Box|Selected cell|Same numbers)$/)
  expect(labels.map((label) => label.props.children)).toEqual(LABELS)
  for (const label of LABELS) expect(screen.getByLabelText(label).props.value).toBe(true)
})

it('turns an assist off and saves it', async () => {
  render(<SettingsScreen onBack={jest.fn()} />)
  await act(async () => fireEvent(screen.getByLabelText('Box'), 'valueChange', false))
  expect(screen.getByLabelText('Box').props.value).toBe(false)
  expect(Storage.setItemAsync).toHaveBeenLastCalledWith(ASSISTS_KEY, JSON.stringify({ ...DEFAULT_ASSISTS, box: false }))
})

it('saves the theme choice', async () => {
  render(<SettingsScreen onBack={jest.fn()} />)
  expect(screen.getByRole('button', { name: 'System', selected: true })).toBeTruthy()
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Midnight' })))
  expect(screen.getByRole('button', { name: 'Midnight', selected: true })).toBeTruthy()
  expect(Storage.setItemAsync).toHaveBeenLastCalledWith(THEME_PREFERENCE_KEY, 'midnight')
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
  await act(async () => fireEvent(screen.getByLabelText('Box'), 'valueChange', false))
  // Cell 31 is in the box of cell 39, not in its row or column, and holds no 8.
  const cell31 = screen.getByTestId('cell-31', { includeHiddenElements: true })
  expect(StyleSheet.flatten(cell31.props.style).backgroundColor).toBe(daylight.components.cell.fill)
})
