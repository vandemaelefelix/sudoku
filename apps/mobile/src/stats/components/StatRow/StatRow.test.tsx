import { render, screen } from '@testing-library/react-native'
import { StatRow } from './StatRow'

it('shows the label, the note and the value, and reads them as one line', () => {
  render(<StatRow label="Best" note="no hints" value="04:32" />)
  expect(screen.getByText('04:32')).toBeTruthy()
  expect(screen.getByLabelText('Best, no hints: 04:32')).toBeTruthy()
})

it('reads a row without a note', () => {
  render(<StatRow label="Played" value="12" />)
  expect(screen.getByLabelText('Played: 12')).toBeTruthy()
})
