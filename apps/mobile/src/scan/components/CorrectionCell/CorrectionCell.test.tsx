import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { NO_PULSE, POP_PEAK_AT, WAVE_PEAK_AT } from '@/game/constants/pulse.constants'
import type { Pulse } from '@/game/hooks/usePulse'
import { pulseLook } from '@/game/utils/pulse.utils'
import { midnight } from '@/theme/themes/midnight'
import { CorrectionCell } from './CorrectionCell'
import { daylight } from '@/theme/themes/daylight'

const look = { digit: '7', style: 'entry', uncertain: true } as const
const at = { size: 40, digitSizes: { given: 28, entry: 22 }, left: 0, top: 0, reduceMotion: false } as const

it('reads no theme hook, so a theme switch does not re-render the 81 cells (ADR-015)', () => {
  const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
  const theming = jest.spyOn(unistyles, 'useUnistyles')
  render(<CorrectionCell n={0} look={look} {...at} />)
  expect(theming).not.toHaveBeenCalled()
  theming.mockRestore()
})

it('draws the ring of an uncertain cell in the warning colour of the theme', () => {
  render(<CorrectionCell n={0} look={look} {...at} />)
  expect(StyleSheet.flatten(screen.getByTestId('correction-ring-0').props.style)).toMatchObject({
    borderColor: daylight.colors.warning,
  })
})

const given = { digit: '5', style: 'given', uncertain: false } as const
const fill = (n: number) => StyleSheet.flatten(screen.getByTestId(`correction-fill-${n}`).props.style)

it('fills an open cell to check with the warning surface, and a sure open cell with the selected token', () => {
  render(
    <>
      <CorrectionCell n={0} look={look} selected {...at} />
      <CorrectionCell n={1} look={given} selected {...at} />
    </>,
  )
  expect(fill(0)).toMatchObject({ backgroundColor: daylight.colors.warningSurface })
  expect(screen.getByTestId('correction-ring-0')).toBeTruthy()
  expect(fill(1)).toMatchObject({ backgroundColor: daylight.components.cell.selected })
  expect(screen.queryByTestId('correction-ring-1')).toBeNull()
})

it('draws no fill on a plain cell', () => {
  render(<CorrectionCell n={0} look={given} {...at} />)
  expect(screen.queryByTestId('correction-fill-0')).toBeNull()
})

it('marks a conflict with the conflict fill and the conflict colour', () => {
  render(<CorrectionCell n={0} look={given} conflict {...at} />)
  expect(fill(0)).toMatchObject({ backgroundColor: daylight.components.cell.conflictFill })
  expect(StyleSheet.flatten(screen.getByTestId('correction-cell-0').props.style)).toMatchObject({
    color: daylight.components.cell.conflict,
    fontWeight: daylight.type.given.weight,
  })
})

it('shows the selected fill over the conflict fill', () => {
  render(<CorrectionCell n={0} look={given} conflict selected {...at} />)
  expect(fill(0)).toMatchObject({ backgroundColor: daylight.components.cell.selected })
})

it('calls onSelect with its index', () => {
  const onSelect = jest.fn()
  render(<CorrectionCell n={12} look={given} onSelect={onSelect} {...at} />)
  fireEvent.press(screen.getByTestId('correction-press-12'))
  expect(onSelect).toHaveBeenCalledWith(12)
})

it('is not pressable without onSelect, as during the transition', () => {
  render(<CorrectionCell n={0} look={given} {...at} />)
  const press = screen.getByTestId('correction-press-0')
  expect(press.props.accessibilityState).toMatchObject({ disabled: true })
  expect(press.props.accessible).toBe(false)
})

it('gives VoiceOver the place, the kind, the digit and the selection', () => {
  render(<CorrectionCell n={0} look={look} selected onSelect={jest.fn()} {...at} />)
  const cell = screen.getByLabelText('Row 1, column 1, entry 7, check this cell')
  expect(cell.props.accessibilityState).toMatchObject({ selected: true, disabled: false })
})

it('turns the ring of the open cell solid', () => {
  render(<CorrectionCell n={0} look={look} selected {...at} />)
  expect(StyleSheet.flatten(screen.getByTestId('correction-ring-0').props.style)).toMatchObject({
    borderStyle: 'solid',
  })
})

it('shows a solution digit muted, in the face and the size of a given, and never over a digit', () => {
  render(
    <>
      <CorrectionCell n={0} look={{ digit: '', style: 'empty', uncertain: false }} solution="4" {...at} />
      <CorrectionCell n={1} look={given} solution="9" {...at} />
    </>,
  )
  expect(screen.getByTestId('correction-solution-0')).toHaveTextContent('4')
  expect(StyleSheet.flatten(screen.getByTestId('correction-solution-0').props.style)).toMatchObject({
    color: daylight.colors.textMuted,
    fontFamily: daylight.type.given.family,
    fontSize: 28,
  })
  expect(screen.queryByTestId('correction-solution-1')).toBeNull()
  expect(screen.getByTestId('correction-cell-1')).toHaveTextContent('5')
})

it('sizes a given and an entry from the digit sizes of the screen', () => {
  render(
    <>
      <CorrectionCell n={0} look={given} {...at} />
      <CorrectionCell n={1} look={look} {...at} />
    </>,
  )
  expect(StyleSheet.flatten(screen.getByTestId('correction-cell-0').props.style).fontSize).toBe(28)
  expect(StyleSheet.flatten(screen.getByTestId('correction-cell-1').props.style).fontSize).toBe(22)
})

it('shows the kind and the confidence of the dev overlay, with a low value in the warning text colour', () => {
  render(<CorrectionCell n={0} look={given} confidence={{ tag: 'P', value: '58', low: true }} {...at} />)
  expect(screen.getByText('P')).toBeTruthy()
  expect(StyleSheet.flatten(screen.getByTestId('correction-confidence-0').props.style)).toMatchObject({
    color: daylight.colors.warningText,
  })
})

it('draws the solution digit of a wrong cell in the corner, and keeps the digit of the player', () => {
  render(<CorrectionCell n={0} look={look} conflict hint="2" {...at} />)
  expect(screen.getByTestId('correction-cell-0')).toHaveTextContent('7')
  expect(screen.getByTestId('correction-hint-0')).toHaveTextContent('2')
  expect(StyleSheet.flatten(screen.getByTestId('correction-hint-0').props.style)).toMatchObject({
    color: daylight.colors.textMuted,
    position: 'absolute',
  })
})

it('draws no hint without one', () => {
  render(<CorrectionCell n={0} look={look} {...at} />)
  expect(screen.queryByTestId('correction-hint-0')).toBeNull()
})

// A fixed stand-in for a shared value. The Reanimated mock runs each animated style once, at render.
const fixed = <T,>(value: T) => ({ value, get: () => value, set: jest.fn() }) as unknown as SharedValue<T>
const pulseLookOfMidnight = pulseLook(midnight)
const pulseAt = (elapsed: number): Pulse => ({
  delays: fixed<readonly number[]>(Array.from({ length: 81 }, (_, cell) => (cell === 0 ? 0 : NO_PULSE))),
  elapsed: fixed(elapsed),
  look: fixed(pulseLookOfMidnight),
})

it('draws a wave in the accent colour while the solved pulse runs', () => {
  render(<CorrectionCell n={0} look={given} pulse={pulseAt(pulseLookOfMidnight.waveMs * WAVE_PEAK_AT)} {...at} />)
  const wave = StyleSheet.flatten(screen.getByTestId('correction-wave-0').props.style)
  expect(wave.backgroundColor).toBe(daylight.colors.accent)
  expect(wave.opacity).toBeCloseTo(midnight.components.pulse.waveOpacity)
})

it('pops the digit to the peak scale of the theme', () => {
  render(<CorrectionCell n={0} look={given} pulse={pulseAt(pulseLookOfMidnight.popMs * POP_PEAK_AT)} {...at} />)
  const digit = StyleSheet.flatten(screen.getByTestId('correction-cell-0').props.style)
  expect(digit.transform).toEqual([
    { translateY: expect.any(Number) },
    { scale: expect.closeTo(midnight.components.pulse.popScale) },
  ])
})

it('draws no wave without a pulse', () => {
  render(<CorrectionCell n={0} look={given} {...at} />)
  expect(screen.queryByTestId('correction-wave-0')).toBeNull()
})
