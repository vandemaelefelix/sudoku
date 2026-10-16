import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { cobalt } from '@/theme/themes/cobalt'
import { Toggle } from './Toggle'

const { width: TRACK_WIDTH, height: TRACK_HEIGHT, thumb: THUMB } = cobalt.size.toggle

const style = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style)

it('is a switch with a label, a hint and a checked state', () => {
  render(<Toggle label="Box" hint="Shade the box." value onChange={jest.fn()} />)
  const toggle = screen.getByRole('switch', { name: 'Box' })
  expect(toggle.props.accessibilityState).toMatchObject({ checked: true })
  expect(toggle.props.accessibilityHint).toBe('Shade the box.')
})

it('reports the opposite value when tapped', () => {
  const onChange = jest.fn()
  const { rerender } = render(<Toggle label="Box" value={false} onChange={onChange} />)
  fireEvent.press(screen.getByRole('switch'))
  expect(onChange).toHaveBeenLastCalledWith(true)
  rerender(<Toggle label="Box" value onChange={onChange} />)
  fireEvent.press(screen.getByRole('switch'))
  expect(onChange).toHaveBeenLastCalledWith(false)
})

it('has a 44 pt touch target around a 52 by 28 track', () => {
  render(<Toggle label="Box" value={false} onChange={jest.fn()} />)
  expect(StyleSheet.flatten(screen.getByRole('switch').props.style)).toMatchObject({ minHeight: 44 })
  expect(style('toggle-track')).toMatchObject({ width: TRACK_WIDTH, height: TRACK_HEIGHT })
})

it('is boxy: the track and the thumb take their radius from the button tokens and the border is 1.5', () => {
  render(<Toggle label="Box" value={false} onChange={jest.fn()} />)
  expect(style('toggle-track')).toMatchObject({
    borderRadius: cobalt.components.button.radius,
    borderWidth: cobalt.components.button.outlineWidth,
  })
  expect(style('toggle-thumb')).toMatchObject({
    borderRadius: cobalt.components.button.radius,
    width: THUMB,
    height: THUMB,
  })
  expect(cobalt.components.button.radius).toBe(0)
})

it('fills the track and draws a white thumb when on, in Light', () => {
  render(<Toggle label="Box" value onChange={jest.fn()} />)
  expect(style('toggle-track')).toMatchObject({ backgroundColor: cobalt.components.switch.on })
  expect(style('toggle-thumb')).toMatchObject({ backgroundColor: cobalt.components.switch.thumbOn })
})

it('outlines the track and draws an accent thumb when off, in Light', () => {
  render(<Toggle label="Box" value={false} onChange={jest.fn()} />)
  expect(style('toggle-track')).toMatchObject({
    backgroundColor: cobalt.components.switch.off,
    borderColor: cobalt.components.switch.border,
  })
  expect(style('toggle-thumb')).toMatchObject({ backgroundColor: cobalt.components.switch.thumbOff })
})

it('starts the thumb at the near end when off and at the far end when on', () => {
  const off = render(<Toggle label="Box" value={false} onChange={jest.fn()} />)
  expect(style('toggle-thumb').transform).toEqual([{ translateX: 0 }])
  off.unmount()
  render(<Toggle label="Box" value onChange={jest.fn()} />)
  const [{ translateX }] = style('toggle-thumb').transform as [{ translateX: number }]
  // The track is 52 wide with a 1.5 border and the thumb is 18: the thumb ends one gap from the far border.
  expect(translateX).toBeCloseTo(TRACK_WIDTH - 3 - THUMB - 2 * ((TRACK_HEIGHT - 3 - THUMB) / 2), 5)
})
