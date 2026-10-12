import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { UnistylesRuntime } from 'react-native-unistyles'
import { NumberKey } from './NumberKey'

const doneOpacity = () => UnistylesRuntime.getTheme().opacity.disabled

const renderKey = (props: Partial<Parameters<typeof NumberKey>[0]> = {}) => {
  const onPress = jest.fn()
  render(<NumberKey digit={4} notesMode={false} complete={false} disabled={false} onPress={onPress} {...props} />)
  return onPress
}

const open = () => <NumberKey digit={4} notesMode={false} complete={false} disabled={false} onPress={jest.fn()} />

afterEach(() => jest.mocked(useReducedMotion).mockReturnValue(false))

it('reads "Enter 4" and is enabled while the number is open', () => {
  renderKey()
  expect(screen.getByLabelText('Enter 4')).toBeEnabled()
  expect(screen.getByTestId('number-key-4')).toHaveStyle({ opacity: 1 })
})

it('disables a complete key and reads "all nine placed"', () => {
  const onPress = renderKey({ complete: true })
  const key = screen.getByLabelText('Enter 4, all nine placed')
  expect(key).toBeDisabled()
  fireEvent.press(key)
  expect(onPress).not.toHaveBeenCalled()
})

it('reads "Note 4, all nine placed" in notes mode', () => {
  renderKey({ complete: true, notesMode: true })
  expect(screen.getByLabelText('Note 4, all nine placed')).toBeDisabled()
})

it('fades a complete key to the disabled opacity', () => {
  renderKey({ complete: true })
  expect(screen.getByTestId('number-key-4')).toHaveStyle({ opacity: doneOpacity() })
})

it('drops the fill and the shadow of a complete key', () => {
  renderKey({ complete: true })
  const style = StyleSheet.flatten(screen.getByLabelText('Enter 4, all nine placed').props.style)
  expect(style.backgroundColor).toBeUndefined()
  expect(style.boxShadow).toBeUndefined()
})

it('keeps the scale at 1 with Reduce Motion', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  renderKey({ complete: true })
  expect(screen.getByTestId('number-key-4')).toHaveStyle({ opacity: doneOpacity(), transform: [{ scale: 1 }] })
})

it('comes back at full opacity when the number opens again', () => {
  renderKey({ complete: true })
  // The Reanimated mock reads the shared value during render. The effect resets it after the first render.
  screen.rerender(open())
  screen.rerender(open())
  expect(screen.getByLabelText('Enter 4')).toBeEnabled()
  expect(screen.getByTestId('number-key-4')).toHaveStyle({ opacity: 1, transform: [{ scale: 1 }] })
})
