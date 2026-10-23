import { render, screen } from '@testing-library/react-native'
import { Icon } from './Icon'
import { cobalt } from '@/theme/themes/cobalt'

it('strokes the path of the icon in the colour of its tone', () => {
  render(<Icon name="undo" tone="accent" />)
  const path = screen.getByTestId('skia-path')
  expect(path.props.path).toBe('M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11')
  expect(path.props.color).toBe(cobalt.colors.accent)
  expect(path.props.style).toBe('stroke')
})

it('draws the play icon in the colour on the accent', () => {
  render(<Icon name="play" tone="onAccent" size={16} />)
  const path = screen.getByTestId('skia-path')
  expect(path.props.path).toBe('M8 5l11 7-11 7z')
  expect(path.props.color).toBe(cobalt.colors.onAccent)
})

it('draws with its own colour when it has one, over the tone', () => {
  render(<Icon name="pause" tone="text" color={cobalt.components.finishCard.entry} />)
  expect(screen.getByTestId('skia-path').props.color).toBe(cobalt.components.finishCard.entry)
})

it('draws the scan icon', () => {
  render(<Icon name="scan" tone="text" size={16} />)
  expect(screen.getByTestId('skia-path').props.path).toContain('M4 8V5')
})

it('draws the photo icon', () => {
  render(<Icon name="photo" tone="text" />)
  expect(screen.getByTestId('skia-path').props.path).toContain('M5 4h14')
})

it('draws the small icons with a thicker line', () => {
  render(<Icon name="pause" tone="text" size={16} />)
  expect(screen.getByTestId('skia-path').props.strokeWidth).toBe(2)
})
