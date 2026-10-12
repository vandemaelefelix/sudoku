import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { PANEL_HEIGHT, PANEL_PADDING } from '@/scan/constants/correction.constants'
import type { CellLook } from '@/scan/utils/correction.utils'
import { daylight } from '@/theme/themes/daylight'
import { CorrectionPad } from './CorrectionPad'

const GIVEN_5: CellLook = { digit: '5', style: 'given', uncertain: false }
const EMPTY: CellLook = { digit: '', style: 'empty', uncertain: false }
const style = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style)

function renderPad(look: CellLook = GIVEN_5) {
  const handlers = { onDigit: jest.fn(), onClear: jest.fn(), onKind: jest.fn(), onDone: jest.fn() }
  render(<CorrectionPad cell={11} look={look} {...handlers} />)
  return handlers
}

it('sends each digit key', () => {
  const { onDigit } = renderPad()
  for (let digit = 1; digit <= 9; digit++) fireEvent.press(screen.getByLabelText(`Set ${digit}`))
  expect(onDigit.mock.calls.map(([digit]) => digit)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
})

it('puts 1 to 5 in the first row, and 6 to 9 with Clear in the second', () => {
  renderPad()
  expect(screen.getByTestId('correction-pad-row-0')).toHaveTextContent('12345')
  expect(screen.getByTestId('correction-pad-row-1')).toHaveTextContent('6789Clear')
})

it('clears the cell', () => {
  const { onClear } = renderPad()
  fireEvent.press(screen.getByLabelText('Clear the cell'))
  expect(onClear).toHaveBeenCalledTimes(1)
})

it('shows the kind of the cell and switches it', () => {
  const { onKind } = renderPad()
  expect(screen.getByTestId('correction-kind-given').props.accessibilityState).toMatchObject({ checked: true })
  expect(screen.getByTestId('correction-kind-entry').props.accessibilityState).toMatchObject({ checked: false })
  fireEvent.press(screen.getByTestId('correction-kind-entry'))
  expect(onKind).toHaveBeenCalledWith('entry')
})

it('disables the kind switch for an empty cell', () => {
  const { onKind } = renderPad(EMPTY)
  expect(screen.getByTestId('correction-kind-given').props.accessibilityState).toMatchObject({ disabled: true })
  fireEvent.press(screen.getByTestId('correction-kind-given'))
  expect(onKind).not.toHaveBeenCalled()
})

it('says which cell each control changes', () => {
  renderPad()
  for (const testID of ['correction-key-1', 'correction-clear', 'correction-kind-entry']) {
    expect(screen.getByTestId(testID).props.accessibilityHint).toBe('Changes row 2, column 3')
  }
})

it('gives each kind radio a touch target of 44 pt', () => {
  renderPad()
  const { hitSlop } = screen.getByTestId('correction-kind-given').props
  expect(daylight.size.touch - 2 * daylight.space.xs + 2 * hitSlop).toBeGreaterThanOrEqual(daylight.size.touch)
})

it('calls onDone', () => {
  const { onDone } = renderPad()
  fireEvent.press(screen.getByLabelText('Done'))
  expect(onDone).toHaveBeenCalledTimes(1)
})

it('makes every row one touch target high, so three rows fit in the panel', () => {
  renderPad()
  for (const row of ['correction-pad-kinds', 'correction-pad-row-0', 'correction-pad-row-1']) {
    expect(style(row).height).toBe(daylight.size.touch)
  }
  expect(3 * daylight.size.touch + 2 * daylight.space.xs).toBeLessThanOrEqual(PANEL_HEIGHT - 2 * PANEL_PADDING)
})

it('takes its colours from the semantic tokens', () => {
  renderPad()
  expect(style('correction-key-1')).toMatchObject({ backgroundColor: daylight.colors.background })
  expect(style('correction-kind-given')).toMatchObject({ backgroundColor: daylight.colors.accent })
})
