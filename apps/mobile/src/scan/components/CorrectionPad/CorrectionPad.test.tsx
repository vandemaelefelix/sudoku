import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import type { CellLook } from '@/scan/utils/correction.utils'
import { daylight } from '@/theme/themes/daylight'
import { CorrectionPad } from './CorrectionPad'

const GIVEN_5: CellLook = { digit: '5', style: 'given', uncertain: false }
const style = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style)

function renderPad(look: CellLook = GIVEN_5, hint: number | null = null) {
  const handlers = { onDigit: jest.fn(), onClear: jest.fn() }
  render(<CorrectionPad cell={11} look={look} hint={hint} {...handlers} />)
  return handlers
}

it('sends each digit key', () => {
  const { onDigit } = renderPad()
  for (let digit = 1; digit <= 9; digit++) fireEvent.press(screen.getByLabelText(`Set ${digit}`))
  expect(onDigit.mock.calls.map(([digit]) => digit)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
})

it('puts 1 to 5 in the first row, and 6 to 9 with Empty in the second', () => {
  renderPad()
  expect(screen.getByTestId('correction-pad-row-0')).toHaveTextContent('12345')
  expect(screen.getByTestId('correction-pad-row-1')).toHaveTextContent('6789Empty')
})

it('empties the cell', () => {
  const { onClear } = renderPad()
  fireEvent.press(screen.getByLabelText('Empty cell'))
  expect(onClear).toHaveBeenCalledTimes(1)
})

it('shows the digit of the cell as the current key, in the primary button colour', () => {
  renderPad()
  expect(screen.getByTestId('correction-key-5').props.accessibilityState).toMatchObject({ selected: true })
  expect(style('correction-key-5')).toMatchObject({ backgroundColor: daylight.components.button.primary })
  expect(style('correction-key-4')).toMatchObject({ backgroundColor: daylight.components.panel.key })
})

it('rings the second guess of the model', () => {
  renderPad({ ...GIVEN_5, uncertain: true }, 9)
  expect(screen.getByTestId('correction-key-9')).toContainElement(screen.getByTestId('correction-hint'))
})

it('rings Empty when the second guess is an empty cell, and nothing without a guess', () => {
  renderPad(GIVEN_5, 0)
  expect(screen.getByTestId('correction-clear')).toContainElement(screen.getByTestId('correction-hint'))
  screen.unmount()
  renderPad()
  expect(screen.queryByTestId('correction-hint')).toBeNull()
})

it('says which cell each key changes', () => {
  renderPad()
  for (const testID of ['correction-key-1', 'correction-clear']) {
    expect(screen.getByTestId(testID).props.accessibilityHint).toBe('Changes row 2, column 3')
  }
})
