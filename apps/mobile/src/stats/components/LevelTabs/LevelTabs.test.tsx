import { fireEvent, render, screen } from '@testing-library/react-native'
import { LevelTabs } from './LevelTabs'

it('lists All and the four levels, and marks the chosen tab', () => {
  render(<LevelTabs value="medium" onChange={jest.fn()} />)
  for (const name of ['All', 'Easy', 'Hard', 'Expert']) {
    expect(screen.getByRole('tab', { name, selected: false })).toBeTruthy()
  }
  expect(screen.getByRole('tab', { name: 'Medium', selected: true })).toBeTruthy()
})

it('asks for the tab that the player taps', () => {
  const onChange = jest.fn()
  render(<LevelTabs value="all" onChange={onChange} />)
  fireEvent.press(screen.getByRole('tab', { name: 'Expert' }))
  expect(onChange).toHaveBeenCalledWith('expert')
  fireEvent.press(screen.getByRole('tab', { name: 'All' }))
  expect(onChange).toHaveBeenLastCalledWith('all')
})
