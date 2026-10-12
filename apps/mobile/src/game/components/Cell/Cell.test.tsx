import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { NO_PULSE, POP_PEAK_AT, WAVE_PEAK_AT } from '@/game/constants/pulse.constants'
import type { Pulse } from '@/game/hooks/usePulse'
import { pulseLook } from '@/game/utils/pulse.utils'
import { daylight } from '@/theme/themes/daylight'
import { midnight } from '@/theme/themes/midnight'
import { Cell } from './Cell'

// Midnight, not the Daylight of the Unistyles mock: the strengths must come from the pulse, not from the styles.
const look = pulseLook(midnight)

// A fixed stand-in for a shared value. The Reanimated mock runs each animated style once, at render.
const fixed = <T,>(value: T) => ({ value, get: () => value, set: jest.fn() }) as unknown as SharedValue<T>
const pulseAt = (elapsed: number, delays: readonly number[] = Array(81).fill(NO_PULSE)): Pulse => ({
  delays: fixed(delays),
  elapsed: fixed(elapsed),
  look: fixed(look),
})
const inPulse = Array.from({ length: 81 }, (_, cell) => (cell === 2 ? 0 : NO_PULSE))

const base = {
  cell: 2,
  digit: 0,
  digitStyle: 'entry',
  notes: '',
  fill: 'plain',
  ring: false,
  label: 'cell',
  pulse: pulseAt(0),
} as const

it('reads no theme hook, so a theme switch does not re-render the 81 cells (ADR-015)', () => {
  const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
  const theming = jest.spyOn(unistyles, 'useUnistyles')
  render(<Cell {...base} onSelect={jest.fn()} />)
  expect(theming).not.toHaveBeenCalled()
  theming.mockRestore()
})

it('draws a wrong entry in the conflict colours', () => {
  render(<Cell {...base} digit={6} digitStyle="wrong" fill="conflict" onSelect={jest.fn()} />)
  expect(StyleSheet.flatten(screen.getByTestId('cell-2').props.style)).toMatchObject({
    backgroundColor: daylight.components.cell.conflictFill,
  })
  expect(StyleSheet.flatten(screen.getByText('6').props.style)).toMatchObject({
    color: daylight.components.cell.conflict,
  })
})

it('draws the notes at 11 pt or more, each in its own place of a 3 × 3 set', () => {
  render(<Cell {...base} notes="39" onSelect={jest.fn()} />)
  const three = StyleSheet.flatten(screen.getByText('3').props.style)
  expect(three.fontSize).toBeGreaterThanOrEqual(11)
  expect(screen.getAllByTestId(/^note-slot-/)).toHaveLength(9)
})

it('selects its cell when tapped', () => {
  const onSelect = jest.fn()
  render(<Cell {...base} onSelect={onSelect} />)
  fireEvent.press(screen.getByTestId('cell-2'))
  expect(onSelect).toHaveBeenCalledWith(2)
})

it('draws a ring when the selected-cell assist is off', () => {
  render(<Cell {...base} ring onSelect={jest.fn()} />)
  expect(StyleSheet.flatten(screen.getByTestId('cell-2').props.style)).toMatchObject({
    borderColor: daylight.components.cell.ring,
  })
})

it('draws the wave in the accent colour at the peak opacity of the theme', () => {
  render(<Cell {...base} digit={4} pulse={pulseAt(look.waveMs * WAVE_PEAK_AT, inPulse)} onSelect={jest.fn()} />)
  const wave = StyleSheet.flatten(screen.getByTestId('cell-2-wave').props.style)
  expect(wave.backgroundColor).toBe(daylight.colors.accent)
  expect(wave.opacity).toBeCloseTo(midnight.components.pulse.waveOpacity)
})

it('pops the digit to the peak scale of the theme', () => {
  render(<Cell {...base} digit={4} pulse={pulseAt(look.popMs * POP_PEAK_AT, inPulse)} onSelect={jest.fn()} />)
  const digit = StyleSheet.flatten(screen.getByText('4').props.style)
  expect(digit.transform).toEqual([{ scale: expect.closeTo(midnight.components.pulse.popScale) }])
})

it('shows no wave and no pop outside a pulse', () => {
  render(<Cell {...base} digit={4} pulse={pulseAt(look.waveMs * WAVE_PEAK_AT)} onSelect={jest.fn()} />)
  expect(StyleSheet.flatten(screen.getByTestId('cell-2-wave').props.style).opacity).toBe(0)
  expect(StyleSheet.flatten(screen.getByText('4').props.style).transform).toEqual([{ scale: 1 }])
})

it('draws a still cell without a pulse, for a grid outside a game', () => {
  const { pulse: _none, ...still } = base
  render(<Cell {...still} digit={4} onSelect={jest.fn()} />)
  expect(screen.queryByTestId('cell-2-wave')).toBeNull()
  expect(StyleSheet.flatten(screen.getByText('4').props.style).transform).toEqual([{ scale: 1 }])
})

it('lets a tap through the wave', () => {
  const onSelect = jest.fn()
  render(<Cell {...base} pulse={pulseAt(look.waveMs * WAVE_PEAK_AT, inPulse)} onSelect={onSelect} />)
  expect(StyleSheet.flatten(screen.getByTestId('cell-2-wave').props.style).pointerEvents).toBe('none')
  fireEvent.press(screen.getByTestId('cell-2'))
  expect(onSelect).toHaveBeenCalledWith(2)
})
