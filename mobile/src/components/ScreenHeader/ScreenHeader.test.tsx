import { fireEvent, render, screen } from '@testing-library/react-native'
import { ScreenHeader } from './ScreenHeader'

it('has a Back button that reports a press', () => {
  const onBack = jest.fn()
  render(<ScreenHeader title="Settings" onBack={onBack} />)
  fireEvent.press(screen.getByRole('button', { name: 'Back' }))
  expect(onBack).toHaveBeenCalledTimes(1)
})

it('shows the title as a header', () => {
  render(<ScreenHeader title="Settings" onBack={jest.fn()} />)
  expect(screen.getByRole('header', { name: 'Settings' })).toBeTruthy()
})

it('shows no title when it gets none', () => {
  render(<ScreenHeader onBack={jest.fn()} />)
  expect(screen.queryByRole('header')).toBeNull()
})
