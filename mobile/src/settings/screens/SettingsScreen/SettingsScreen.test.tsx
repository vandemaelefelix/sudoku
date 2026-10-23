import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import Storage from 'expo-sqlite/kv-store'
import type { ReactNode } from 'react'
import { Linking, ScrollView, StyleSheet } from 'react-native'
import { AccountContext, UNCONFIGURED_ACCOUNT } from '@/account/hooks/useAccount'
import { ASSISTS_KEY, DEFAULT_ASSISTS, type AssistName } from '@/game/constants/assists.constants'
import { useAssists } from '@/game/hooks/useAssists'
import { HAPTICS_KEY } from '@/preferences/constants/haptics.constants'
import { useHaptics } from '@/preferences/hooks/useHaptics'
import { POLICY_URL, SHARE_SCANS_KEY } from '@/scanShare/constants/scanShare.constants'
import { shareStore } from '@/scanShare/shareStore'
import { APPEARANCE_PREFERENCE_KEY, THEME_PREFERENCE_KEY } from '@/theme/preference'
import { resetThemeSession } from '@/theme/session'
import { cobalt, cobaltColour } from '@/theme/themes/cobalt'
import { I18nProvider } from '@/i18n/components/I18nProvider'
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
  render(<SettingsScreen onBack={jest.fn()} onSignIn={jest.fn()} onTechniques={jest.fn()} />)
  const labels = screen.getAllByText(/^(Row and column|Box|Selected cell|Same numbers)$/, {
    includeHiddenElements: true,
  })
  expect(labels.map((label) => label.props.children)).toEqual(LABELS)
  for (const label of LABELS)
    expect(screen.getByLabelText(label).props.accessibilityState).toMatchObject({ checked: true })
})

it('turns an assist off and saves it', async () => {
  render(<SettingsScreen onBack={jest.fn()} onSignIn={jest.fn()} onTechniques={jest.fn()} />)
  await act(async () => fireEvent.press(screen.getByLabelText('Box')))
  expect(screen.getByLabelText('Box').props.accessibilityState).toMatchObject({ checked: false })
  expect(Storage.setItemAsync).toHaveBeenLastCalledWith(ASSISTS_KEY, JSON.stringify({ ...DEFAULT_ASSISTS, box: false }))
})

it('saves the theme choice', async () => {
  render(<SettingsScreen onBack={jest.fn()} onSignIn={jest.fn()} onTechniques={jest.fn()} />)
  expect(screen.getByRole('button', { name: 'Cobalt', selected: true })).toBeTruthy()
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Forest' })))
  expect(screen.getByRole('button', { name: 'Forest', selected: true })).toBeTruthy()
  expect(Storage.setItemAsync).toHaveBeenLastCalledWith(THEME_PREFERENCE_KEY, 'forest')
})

it('shows the appearance under the theme, Light by default, and saves a new choice', async () => {
  render(<SettingsScreen onBack={jest.fn()} onSignIn={jest.fn()} onTechniques={jest.fn()} />)
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
  render(<SettingsScreen onBack={onBack} onSignIn={jest.fn()} onTechniques={jest.fn()} />)
  const back = screen.getByRole('button', { name: 'Back' })
  fireEvent.press(back)
  expect(onBack).toHaveBeenCalled()
  expect(StyleSheet.flatten(back.props.style)).toMatchObject({ width: 44, height: 44 })
})

it('shows the headings and the hint of the canvas', () => {
  render(<SettingsScreen onBack={jest.fn()} onSignIn={jest.fn()} onTechniques={jest.fn()} />)
  expect(screen.getByText('Settings')).toBeTruthy()
  expect(screen.getByText('Assists')).toBeTruthy()
  expect(screen.getByText('Turn these off for a raw game.')).toBeTruthy()
  expect(screen.getByText('Theme')).toBeTruthy()
})

it('shows a switch in the preview at once', async () => {
  render(<SettingsScreen onBack={jest.fn()} onSignIn={jest.fn()} onTechniques={jest.fn()} />)
  await act(async () => fireEvent.press(screen.getByLabelText('Box')))
  // Cell 31 is in the box of cell 39, not in its row or column, and holds no 8.
  const cell31 = screen.getByTestId('cell-31', { includeHiddenElements: true })
  expect(StyleSheet.flatten(cell31.props.style).backgroundColor).toBe(cobalt.components.cell.fill)
})

// FramedCard draws the line between rows as an overlay: a host View that ignores touches.
const isRule = (node: { type: unknown; props: { pointerEvents?: string } }) =>
  typeof node.type === 'string' && node.props.pointerEvents === 'none'

describe('the haptics switch', () => {
  afterEach(async () => {
    const { result, unmount } = renderHook(() => useHaptics())
    await act(async () => result.current.setOn(true))
    unmount()
  })

  it('is on by default, and turning it off saves the switch and plays no tick', async () => {
    render(<SettingsScreen onBack={jest.fn()} onSignIn={jest.fn()} onTechniques={jest.fn()} />)
    const row = screen.getByLabelText('Haptics')
    expect(row.props.accessibilityState).toMatchObject({ checked: true })
    jest.mocked(Haptics.selectionAsync).mockClear()
    await act(async () => fireEvent.press(row))
    expect(Storage.setItemAsync).toHaveBeenLastCalledWith(HAPTICS_KEY, 'off')
    expect(Haptics.selectionAsync).not.toHaveBeenCalled()
  })

  it('ticks for an assist switch and a theme choice', async () => {
    render(<SettingsScreen onBack={jest.fn()} onSignIn={jest.fn()} onTechniques={jest.fn()} />)
    jest.mocked(Haptics.selectionAsync).mockClear()
    await act(async () => fireEvent.press(screen.getByLabelText('Box')))
    fireEvent.press(screen.getByRole('button', { name: 'Forest' }))
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2)
  })
})

it('draws the scroll bars in the colour of the theme, so they show on a dark Colour page', () => {
  const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
  const view = render(<SettingsScreen onBack={jest.fn()} onSignIn={jest.fn()} onTechniques={jest.fn()} />)
  expect(view.UNSAFE_getByType(ScrollView).props.indicatorStyle).toBe(cobalt.scrollIndicator)
  view.unmount()
  jest
    .spyOn(unistyles, 'useUnistyles')
    .mockReturnValue({ theme: cobaltColour, rt: unistyles.UnistylesRuntime } as never)
  const colour = render(<SettingsScreen onBack={jest.fn()} onSignIn={jest.fn()} onTechniques={jest.fn()} />)
  expect(colour.UNSAFE_getByType(ScrollView).props.indicatorStyle).toBe(cobaltColour.scrollIndicator)
  jest.restoreAllMocks()
})

describe('the Op-art look of the page (ADR-026)', () => {
  it('puts a short wavy rule under each of the seven headings', () => {
    render(<SettingsScreen onBack={jest.fn()} onSignIn={jest.fn()} onTechniques={jest.fn()} />)
    expect(screen.getAllByTestId('decoration-opart-section-rule')).toHaveLength(7)
  })

  it('draws the assists in one framed block with square corners and the border of the stats card', () => {
    render(<SettingsScreen onBack={jest.fn()} onSignIn={jest.fn()} onTechniques={jest.fn()} />)
    const style = StyleSheet.flatten(screen.getByTestId('assist-card').props.style)
    expect(style).toMatchObject({
      borderRadius: cobalt.components.summary.radius,
      borderWidth: cobalt.components.summary.borderWidth,
      borderColor: cobalt.components.summary.border,
    })
    expect(cobalt.components.summary.radius).toBe(0)
  })

  it('divides the rows by the strong rule of the box-line weight', () => {
    render(<SettingsScreen onBack={jest.fn()} onSignIn={jest.fn()} onTechniques={jest.fn()} />)
    // FramedCard wraps each row and draws the line as an overlay in that wrapper.
    let line
    for (let node = screen.getByTestId('assist-row-Box').parent; node && !line; node = node.parent) {
      line = node.findAll(isRule)[0]
    }
    expect(StyleSheet.flatten(line?.props.style)).toMatchObject({
      height: cobalt.components.summary.ruleWidth,
      backgroundColor: cobalt.components.summary.rule,
    })
  })
})

function SignedOut({ children }: { children: ReactNode }) {
  return <AccountContext value={{ ...UNCONFIGURED_ACCOUNT, status: 'signedOut' }}>{children}</AccountContext>
}

describe('the account section', () => {
  it('is not there when the build has no account', () => {
    render(<SettingsScreen onBack={jest.fn()} onSignIn={jest.fn()} onTechniques={jest.fn()} />)
    expect(screen.queryByText('Account')).toBeNull()
  })

  it('comes after Scanning and opens the sign-in screen', () => {
    const onSignIn = jest.fn()
    render(<SettingsScreen onBack={jest.fn()} onSignIn={onSignIn} onTechniques={jest.fn()} />, { wrapper: SignedOut })
    const headings = screen.getAllByRole('header').map((heading) => heading.props.children)
    expect(headings.slice(-2)).toEqual(['Scanning', 'Account'])
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }))
    expect(onSignIn).toHaveBeenCalled()
  })
})

describe('the Scanning section (ADR-030)', () => {
  afterEach(async () => {
    await Storage.setItemAsync(SHARE_SCANS_KEY, 'on')
    await act(async () => shareStore.set(true))
  })

  it('shows "Help improve the app", on by default, above the account section', () => {
    render(<SettingsScreen onBack={jest.fn()} onSignIn={jest.fn()} onTechniques={jest.fn()} />)
    expect(screen.getByText('Scanning')).toBeTruthy()
    expect(screen.getByLabelText('Help improve the app').props.accessibilityState).toMatchObject({ checked: true })
  })

  it('saves the switch when the player turns it off', async () => {
    render(<SettingsScreen onBack={jest.fn()} onSignIn={jest.fn()} onTechniques={jest.fn()} />)
    await act(async () => fireEvent.press(screen.getByLabelText('Help improve the app')))
    expect(screen.getByLabelText('Help improve the app').props.accessibilityState).toMatchObject({ checked: false })
    expect(Storage.setItemAsync).toHaveBeenCalledWith(SHARE_SCANS_KEY, 'off')
  })

  it('opens the privacy policy', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    render(<SettingsScreen onBack={jest.fn()} onSignIn={jest.fn()} onTechniques={jest.fn()} />)
    fireEvent.press(screen.getByRole('link', { name: 'Privacy policy' }))
    expect(open).toHaveBeenCalledWith(POLICY_URL)
  })

  it('shows the version and, once it is read, the short contributor ID in the footer', async () => {
    render(<SettingsScreen onBack={jest.fn()} onSignIn={jest.fn()} onTechniques={jest.fn()} />)
    expect(screen.getByText(/^Version /)).toBeTruthy()
    expect(await screen.findByText(/^ID [0-9a-f]{8}$/)).toBeTruthy()
  })
})

it('opens the techniques screen from the Learn section', () => {
  const onTechniques = jest.fn()
  render(<SettingsScreen onBack={jest.fn()} onSignIn={jest.fn()} onTechniques={onTechniques} />)
  expect(screen.getByRole('header', { name: 'Learn' })).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Techniques' }))
  expect(onTechniques).toHaveBeenCalled()
})

describe('the language', () => {
  it('shows the screen in Dutch at once when the player chooses Nederlands, and saves the choice', () => {
    render(
      <I18nProvider>
        <SettingsScreen onBack={jest.fn()} onSignIn={jest.fn()} onTechniques={jest.fn()} />
      </I18nProvider>,
    )
    expect(screen.getByRole('header', { name: 'Settings' })).toBeTruthy()
    fireEvent.press(screen.getByText('Nederlands'))
    expect(screen.getByRole('header', { name: 'Instellingen' })).toBeTruthy()
    expect(screen.getByRole('header', { name: 'Taal' })).toBeTruthy()
    expect(screen.getByText('Hulpmiddelen')).toBeTruthy()
    expect(screen.getByText('Systeem')).toBeTruthy()
    expect(Storage.setItemAsync).toHaveBeenLastCalledWith('app.language', 'nl')
    fireEvent.press(screen.getByText('English'))
    expect(screen.getByRole('header', { name: 'Settings' })).toBeTruthy()
    // Back to System, so the other tests of the file start there.
    fireEvent.press(screen.getByText('System'))
  })
})
