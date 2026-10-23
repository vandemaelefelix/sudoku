import { render, screen } from '@testing-library/react-native'
import { StyleSheet, Text, View } from 'react-native'
import { cobalt } from '@/theme/themes/cobalt'
import { FramedCard } from './FramedCard'

const { ruleWidth } = cobalt.components.summary

// Each child sits in its own wrapper. The wrapper carries the line above the child, so look for it on the way up.
function lineAbove(text: string) {
  for (let node = screen.getByText(text).parent; node; node = node.parent) {
    const style = StyleSheet.flatten(node.props.style)
    if (style?.borderTopWidth !== undefined) return style
  }
  return undefined
}

it('draws no line above the first child', () => {
  render(
    <FramedCard>
      <Text>One</Text>
      <Text>Two</Text>
    </FramedCard>,
  )
  expect(lineAbove('One')).toBeUndefined()
})

it('draws a line between two children', () => {
  render(
    <FramedCard>
      <Text>One</Text>
      <Text>Two</Text>
      <Text>Three</Text>
    </FramedCard>,
  )
  expect(lineAbove('Two')).toMatchObject({ borderTopWidth: ruleWidth })
  expect(lineAbove('Three')).toMatchObject({ borderTopWidth: ruleWidth })
})

it('draws no line for a child that renders nothing', () => {
  render(
    <FramedCard>
      <Text>One</Text>
      {false}
      {null}
      <Text>Two</Text>
    </FramedCard>,
  )
  expect(lineAbove('Two')).toMatchObject({ borderTopWidth: ruleWidth })
})

it('draws no line when it is not divided', () => {
  render(
    <FramedCard divided={false} testID="card">
      <Text>One</Text>
      <Text>Two</Text>
    </FramedCard>,
  )
  expect(lineAbove('One')).toBeUndefined()
  expect(lineAbove('Two')).toBeUndefined()
})

it('frames the children with the summary tokens and the surface colour', () => {
  render(
    <FramedCard testID="card">
      <View />
    </FramedCard>,
  )
  expect(StyleSheet.flatten(screen.getByTestId('card').props.style)).toMatchObject({
    borderWidth: cobalt.components.summary.borderWidth,
    borderRadius: cobalt.components.summary.radius,
    backgroundColor: cobalt.colors.surface,
  })
})

it('leaves out the surface colour when it is not filled', () => {
  render(
    <FramedCard filled={false} testID="card">
      <View />
    </FramedCard>,
  )
  expect(StyleSheet.flatten(screen.getByTestId('card').props.style).backgroundColor).toBeUndefined()
})
