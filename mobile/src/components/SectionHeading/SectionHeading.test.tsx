import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { SectionHeading } from './SectionHeading'

it('shows the title as a header', () => {
  render(<SectionHeading title="Assists" />)
  expect(screen.getByRole('header', { name: 'Assists' })).toBeTruthy()
})

it('shows the hint and the children under the title', () => {
  render(
    <SectionHeading title="Assists" hint="Help on the grid.">
      <Text>Picker</Text>
    </SectionHeading>,
  )
  expect(screen.getByText('Help on the grid.')).toBeTruthy()
  expect(screen.getByText('Picker')).toBeTruthy()
})

it('shows no hint when it gets none', () => {
  render(<SectionHeading title="Assists" />)
  expect(screen.queryByText('Help on the grid.')).toBeNull()
})
