import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { daylight } from '@/theme/themes/daylight'
import { Cell } from './Cell'

const base = { cell: 2, digit: 0, digitStyle: 'entry', notes: '', fill: 'plain', ring: false, label: 'cell' } as const

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
