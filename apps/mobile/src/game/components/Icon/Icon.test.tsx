import { render, screen } from '@testing-library/react-native'
import { Icon } from './Icon'
import { daylight } from '@/theme/themes/daylight'

it('strokes the path of the icon in the colour of its tone', () => {
  render(<Icon name="undo" tone="accent" />)
  const path = screen.getByTestId('skia-path')
  expect(path.props.path).toBe('M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11')
  expect(path.props.color).toBe(daylight.colors.accent)
  expect(path.props.style).toBe('stroke')
})

it('draws the small icons with a thicker line', () => {
  render(<Icon name="pause" tone="text" size={16} />)
  expect(screen.getByTestId('skia-path').props.strokeWidth).toBe(2)
})
