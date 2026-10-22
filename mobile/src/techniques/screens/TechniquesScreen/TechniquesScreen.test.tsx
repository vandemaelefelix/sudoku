import { HINT_TECHNIQUES } from '@sudoku/core'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { techniqueIds } from '@/techniques/utils/techniques.utils'
import { TechniquesScreen } from './TechniquesScreen'

it('lists every technique in hint order, with its name and its definition', () => {
  render(<TechniquesScreen onBack={jest.fn()} onOpen={jest.fn()} />)
  const rows = screen.getAllByRole('button').filter((row) => row.props.accessibilityLabel !== 'Back')
  expect(rows.map((row) => row.props.accessibilityLabel)).toEqual(techniqueIds().map((id) => HINT_TECHNIQUES[id]?.name))
  expect(screen.getByText('A row, column or box with one empty cell. That cell gets the missing digit.')).toBeTruthy()
})

it('opens the page of a technique on a tap', () => {
  const onOpen = jest.fn()
  render(<TechniquesScreen onBack={jest.fn()} onOpen={onOpen} />)
  fireEvent.press(screen.getByRole('button', { name: 'X-wing' }))
  expect(onOpen).toHaveBeenCalledWith('xWing')
})

it('goes back', () => {
  const onBack = jest.fn()
  render(<TechniquesScreen onBack={onBack} onOpen={jest.fn()} />)
  fireEvent.press(screen.getByRole('button', { name: 'Back' }))
  expect(onBack).toHaveBeenCalled()
})
