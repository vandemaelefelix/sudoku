import { render, screen } from '@testing-library/react-native'
import { StyleSheet, Text, View } from 'react-native'
import { cobalt } from '@/theme/themes/cobalt'
import { FramedCard } from './FramedCard'

const { ruleWidth, rule } = cobalt.components.summary

// The line is an overlay: a host View that ignores touches and sits at the top of the wrapper of a child.
const rules = () =>
  screen.UNSAFE_getAllByProps({ pointerEvents: 'none' }).filter((node) => typeof node.type === 'string')

it('draws no line for one child', () => {
  render(
    <FramedCard>
      <Text>One</Text>
    </FramedCard>,
  )
  expect(screen.UNSAFE_queryAllByProps({ pointerEvents: 'none' })).toHaveLength(0)
})

it('draws one line between each two children', () => {
  render(
    <FramedCard>
      <Text>One</Text>
      <Text>Two</Text>
      <Text>Three</Text>
    </FramedCard>,
  )
  expect(rules()).toHaveLength(2)
})

it('draws the line over the top of the child, so it takes no height', () => {
  render(
    <FramedCard>
      <Text>One</Text>
      <Text>Two</Text>
    </FramedCard>,
  )
  const [line] = rules()
  expect(StyleSheet.flatten(line?.props.style)).toMatchObject({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ruleWidth,
    backgroundColor: rule,
  })
  const borders = screen
    .UNSAFE_getAllByType(View)
    .filter((node) => StyleSheet.flatten(node.props.style)?.borderTopWidth !== undefined)
  expect(borders).toHaveLength(0)
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
  expect(rules()).toHaveLength(1)
})

it('counts a Fragment as one child', () => {
  render(
    <FramedCard>
      <>
        <Text>One</Text>
        <Text>Two</Text>
      </>
    </FramedCard>,
  )
  expect(screen.UNSAFE_queryAllByProps({ pointerEvents: 'none' })).toHaveLength(0)
})

it('draws no line when it is not divided', () => {
  render(
    <FramedCard divided={false}>
      <Text>One</Text>
      <Text>Two</Text>
    </FramedCard>,
  )
  expect(screen.UNSAFE_queryAllByProps({ pointerEvents: 'none' })).toHaveLength(0)
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
