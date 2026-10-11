import { Skia } from '@shopify/react-native-skia'
import type { Quad } from '../../../scanner'
import { drawDim } from './dim'

const grid: Quad = [
  { x: 50, y: 300 },
  { x: 350, y: 300 },
  { x: 350, y: 600 },
  { x: 50, y: 600 },
]

function setup() {
  return { canvas: { drawPath: jest.fn() }, paint: Skia.Paint() as unknown as { setAlphaf: jest.Mock } }
}

describe('drawDim', () => {
  it('draws nothing at alpha 0', () => {
    const { canvas, paint } = setup()
    drawDim(canvas as never, paint as never, 402, 874, grid, 0)
    expect(canvas.drawPath).not.toHaveBeenCalled()
  })

  it('dims the whole view without a quad', () => {
    const { canvas, paint } = setup()
    drawDim(canvas as never, paint as never, 402, 874, null, 0.3)
    const [path, used] = canvas.drawPath.mock.calls[0]
    expect(path.calls[0]).toEqual(['moveTo', 0, 0])
    expect(path.calls).not.toContainEqual(['setFillType', 1])
    expect(used).toBe(paint)
    expect(paint.setAlphaf).toHaveBeenCalledWith(0.3)
  })

  it('cuts the grid out of the dim with an even-odd hole', () => {
    const { canvas, paint } = setup()
    drawDim(canvas as never, paint as never, 402, 874, grid, 0.45)
    const path = canvas.drawPath.mock.calls[0][0]
    expect(path.calls).toContainEqual(['moveTo', 50, 300])
    expect(path.calls).toContainEqual(['setFillType', 1])
  })

  it('clamps the alpha to 1', () => {
    const { canvas, paint } = setup()
    drawDim(canvas as never, paint as never, 402, 874, null, 1.4)
    expect(paint.setAlphaf).toHaveBeenCalledWith(1)
  })
})
