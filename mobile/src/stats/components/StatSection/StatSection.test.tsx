import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { StatSection } from './StatSection'

it('shows a title as a header, with its note and its content', () => {
  render(
    <StatSection title="Streak" note="all levels">
      <Text>content</Text>
    </StatSection>,
  )
  expect(screen.getByRole('header', { name: 'Streak all levels' })).toBeTruthy()
  expect(screen.getByText('content')).toBeTruthy()
})
