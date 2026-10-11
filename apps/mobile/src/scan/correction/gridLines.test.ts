import type { SkCanvas, SkPaint } from '@shopify/react-native-skia'
import { drawGridLines } from './gridLines'
import type { Homography } from '@/scan/effects/common/geometry'

const scale90: Homography = [90, 0, 0, 0, 90, 0, 0, 0]

function setup() {
  const widths: number[] = []
  const colours: string[] = []
  const paint = {
    setStyle: jest.fn(),
    setColor: (c: string) => colours.push(c),
    setStrokeWidth: (w: number) => widths.push(w),
  } as unknown as SkPaint
  const lines: { x0: number; y0: number; x1: number; y1: number; width: number; colour: string }[] = []
  const canvas = {
    drawLine: (x0: number, y0: number, x1: number, y1: number) =>
      lines.push({ x0, y0, x1, y1, width: widths[widths.length - 1], colour: colours[colours.length - 1] }),
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
