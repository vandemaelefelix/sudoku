import type { SkCanvas, SkPaint } from '@shopify/react-native-skia'
import { drawGridLines } from './gridLines'
import type { Homography } from '@/utils/homography.utils'

const scale90: Homography = [90, 0, 0, 0, 90, 0, 0, 0]

function setup() {
  let width: number | undefined
  let colour: string | undefined
  const paint = {
    setStyle: jest.fn(),
    setColor: (c: string) => {
      colour = c
    },
    setStrokeWidth: (w: number) => {
      width = w
    },
  } as unknown as SkPaint
  const lines: {
    x0: number
    y0: number
    x1: number
    y1: number
    width: number | undefined
    colour: string | undefined
  }[] = []
  const canvas = {
    drawLine: (x0: number, y0: number, x1: number, y1: number) => lines.push({ x0, y0, x1, y1, width, colour }),
  } as unknown as SkCanvas
  return { canvas, paint, lines }
}

describe('drawGridLines', () => {
  it('draws 20 lines, 8 box lines in ink and 12 cell lines in the line colour', () => {
    const { canvas, paint, lines } = setup()
    drawGridLines(canvas, paint, scale90, 1, '#111', '#ccc')
    expect(lines).toHaveLength(20)
    expect(lines.filter((l) => l.width === 2 && l.colour === '#111')).toHaveLength(8)
    expect(lines.filter((l) => l.width === 1 && l.colour === '#ccc')).toHaveLength(12)
  })

  it('spans the full grid at grow 1', () => {
    const { canvas, paint, lines } = setup()
    drawGridLines(canvas, paint, scale90, 1, '#111', '#ccc')
    expect(lines).toContainEqual(expect.objectContaining({ x0: 0, y0: 30, x1: 90, y1: 30 }))
    expect(lines).toContainEqual(expect.objectContaining({ x0: 30, y0: 0, x1: 30, y1: 90 }))
  })

  it('grows each line from its middle', () => {
    const { canvas, paint, lines } = setup()
    drawGridLines(canvas, paint, scale90, 0.5, '#111', '#ccc')
    expect(lines).toContainEqual(expect.objectContaining({ x0: 22.5, y0: 30, x1: 67.5, y1: 30 }))
  })

  it('draws nothing at grow 0', () => {
    const { canvas, paint, lines } = setup()
    drawGridLines(canvas, paint, scale90, 0, '#111', '#ccc')
    expect(lines).toHaveLength(0)
  })
})
