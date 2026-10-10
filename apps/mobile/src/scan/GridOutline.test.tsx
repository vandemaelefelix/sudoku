import { render, screen } from '@testing-library/react-native'
import type { SharedValue } from 'react-native-reanimated'
import type { Quad } from '../scanner'
import { GridOutline, OUTLINE_WIDTH, outlinePoints } from './GridOutline'

const quad: Quad = [
  { x: 10, y: 20 },
  { x: 110, y: 20 },
  { x: 110, y: 120 },
  { x: 10, y: 120 },
]

describe('outlinePoints', () => {
  it('closes the polygon at the first corner', () => {
    expect(outlinePoints(quad)).toEqual([...quad, quad[0]])
  })

  it('draws nothing without a quad', () => {
    expect(outlinePoints(null)).toEqual([])
  })
})

describe('GridOutline', () => {
  it('draws the quad as a stroked polygon that ignores touches', () => {
    render(<GridOutline outline={{ value: quad } as unknown as SharedValue<Quad | null>} />)
    expect(screen.getByTestId('skia-canvas').props.pointerEvents).toBe('none')
    const points = screen.getByTestId('skia-points').props
    expect(points.points.value).toEqual([...quad, quad[0]])
    expect(points.mode).toBe('polygon')
    expect(points.style).toBe('stroke')
    expect(points.strokeWidth).toBe(OUTLINE_WIDTH)
  })
})
