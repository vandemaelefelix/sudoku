import { render, screen } from '@testing-library/react-native'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { cobalt } from '@/theme/themes/cobalt'
import { Screen } from './Screen'

const content = () => StyleSheet.flatten(screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle)

it('renders its children in a scroll view', () => {
  render(
    <Screen>
      <Text>Inside</Text>
    </Screen>,
  )
  expect(screen.getByText('Inside')).toBeTruthy()
})

it('spaces the children by space.lg in the stacked layout', () => {
  render(
    <Screen>
      <Text>Inside</Text>
    </Screen>,
  )
  expect(content()).toMatchObject({ gap: cobalt.space.lg })
})

it('leaves the spacing to the children in the flow layout', () => {
  render(
    <Screen layout="flow">
      <Text>Inside</Text>
    </Screen>,
  )
  expect(content().gap).toBeUndefined()
})
