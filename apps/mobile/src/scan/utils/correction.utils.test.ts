import { correctionLayout, cellLook, cellsToCheck, drawGridLines, gridLineStyle } from './correction.utils'
import type { Rect } from '@/utils/geometry.utils'
import type { CellResult } from '@/scanner'
import type { SkCanvas, SkPaint } from '@shopify/react-native-skia'
import type { Homography } from '@/utils/homography.utils'
import { PANEL_HEIGHT, REVIEW_CONFIDENCE } from '@/scan/constants/correction.constants'
import { cobalt } from '@/theme/themes/cobalt'

// Three widths and three colours, so each line kind shows which token it reads.
const STYLE = {
  frame: cobalt.components.grid.frame,
  box: cobalt.colors.accent,
  cell: cobalt.components.grid.cellLine,
  frameWidth: 3,
  boxWidth: 2,
  cellWidth: 1,
}
const insets = { top: 62, bottom: 34, left: 0, right: 0 }
const bottom = (r: Rect) => r.y + r.height
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < bottom(b) && b.y < bottom(a)

describe('correctionLayout', () => {
  it('places the bar, the grid and the panel without overlap on a tall view', () => {
    const { bar, title, grid, panel } = correctionLayout({ width: 402, height: 874 }, insets)
    expect(overlaps(bar, grid)).toBe(false)
    expect(overlaps(grid, panel)).toBe(false)
    expect(bar).toEqual({ x: 16, y: 62, width: 370, height: 48 })
    expect(title.height).toBe(0)
    expect(grid.y).toBe(62 + 48 + 28)
  })

  it('leaves room for the title block of a theme with a large title', () => {
    const { title, grid } = correctionLayout({ width: 402, height: 874 }, insets, 60)
    expect(title).toEqual({ x: 16, y: 110, width: 370, height: 60 })
    expect(grid.y).toBe(110 + 60 + 12)
  })

  it('makes the grid square and centred', () => {
    const { grid } = correctionLayout({ width: 402, height: 874 }, insets)
    expect(grid.width).toBe(grid.height)
    expect(grid.width).toBe(370)
    expect(grid.x).toBe((402 - grid.width) / 2)
  })

  it('runs the panel across the width down to the bottom edge, over the bottom inset', () => {
    const { panel } = correctionLayout({ width: 402, height: 874 }, insets)
    expect(bottom(panel)).toBe(874)
    expect(panel.height).toBe(PANEL_HEIGHT + 34)
    expect(panel.x).toBe(0)
    expect(panel.width).toBe(402)
  })

  it('makes the panel taller by the panel edge of the theme', () => {
    expect(correctionLayout({ width: 402, height: 874 }, insets, 0, 30).panel.height).toBe(PANEL_HEIGHT + 34 + 30)
  })

  it('shrinks the grid on a short view', () => {
    const { grid, panel } = correctionLayout({ width: 402, height: 600 }, insets)
    expect(grid.width).toBeLessThan(370)
    expect(grid.width).toBe(grid.height)
    expect(bottom(grid)).toBe(panel.y - 12)
    expect(grid.x).toBe((402 - grid.width) / 2)
  })

  it('gives a grid side of 0, not below, when the view has no room for the grid', () => {
    const { grid } = correctionLayout({ width: 402, height: 200 }, insets)
    expect(grid.width).toBe(0)
    expect(grid.height).toBe(0)
  })

  it('adds the side insets to the margins', () => {
    const { bar } = correctionLayout({ width: 800, height: 400 }, { top: 0, bottom: 0, left: 20, right: 10 })
    expect(bar.x).toBe(36)
    expect(bar.width).toBe(800 - 32 - 30)
  })
})

const cell = (over: Partial<CellResult>): CellResult => ({
  digit: 5,
  kind: 'printed',
  confidence: 1,
  validPair: true,
  second: 3,
  ...over,
})

describe('cellLook', () => {
  it('shows a printed digit as a given', () => {
    expect(cellLook(cell({}))).toEqual({ digit: '5', style: 'given', uncertain: false })
  })

  it('shows a handwritten digit as an entry', () => {
    expect(cellLook(cell({ kind: 'handwritten' }))).toEqual({ digit: '5', style: 'entry', uncertain: false })
  })

  it('shows none and digit 0 as empty', () => {
    expect(cellLook(cell({ kind: 'none', digit: 0 })).style).toBe('empty')
    expect(cellLook(cell({ digit: 0 })).digit).toBe('')
  })

  it('keeps pencil marks as notes, with no digit', () => {
    expect(cellLook(cell({ kind: 'notes', digit: 0 }))).toEqual({ digit: '', style: 'notes', uncertain: false })
    expect(cellLook(cell({ kind: 'notes' })).style).toBe('empty')
  })

  it('marks a cell below the confidence threshold', () => {
    expect(REVIEW_CONFIDENCE).toBe(0.8)
    expect(cellLook(cell({ confidence: 0.79 })).uncertain).toBe(true)
    expect(cellLook(cell({ confidence: 0.8 })).uncertain).toBe(false)
  })

  it('moves the ring with another threshold', () => {
    expect(cellLook(cell({ confidence: 0.85 }), 0.9).uncertain).toBe(true)
    expect(cellLook(cell({ confidence: 0.85 }), 0.6).uncertain).toBe(false)
  })

  it('marks an invalid pair', () => {
    expect(cellLook(cell({ validPair: false })).uncertain).toBe(true)
  })

  it('keeps the ring on an uncertain empty cell', () => {
    expect(cellLook(cell({ kind: 'none', digit: 0, confidence: 0.5 }))).toEqual({
      digit: '',
      style: 'empty',
      uncertain: true,
    })
  })
})

describe('cellsToCheck', () => {
  it('counts the uncertain looks', () => {
    const looks = [
      cell({}),
      cell({ confidence: 0.2 }),
      cell({ validPair: false }),
      cell({ kind: 'none', digit: 0, confidence: 0.1 }),
    ].map((c) => cellLook(c))
    expect(cellsToCheck(looks)).toBe(3)
    expect(cellsToCheck([])).toBe(0)
  })
})

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
  it('draws 20 lines: 4 frame lines, 4 box lines and 12 cell lines, each in its own colour and width', () => {
    const { canvas, paint, lines } = setup()
    drawGridLines(canvas, paint, scale90, 1, STYLE)
    expect(lines).toHaveLength(20)
    expect(lines.filter((l) => l.width === 3 && l.colour === STYLE.frame)).toHaveLength(4)
    expect(lines.filter((l) => l.width === 2 && l.colour === STYLE.box)).toHaveLength(4)
    expect(lines.filter((l) => l.width === 1 && l.colour === STYLE.cell)).toHaveLength(12)
  })

  it('draws the frame last, so a crossing shows the frame colour', () => {
    const { canvas, paint, lines } = setup()
    drawGridLines(canvas, paint, scale90, 1, STYLE)
    expect(lines.slice(-4).every((l) => l.colour === STYLE.frame)).toBe(true)
  })

  it('spans the full grid at grow 1', () => {
    const { canvas, paint, lines } = setup()
    drawGridLines(canvas, paint, scale90, 1, STYLE)
    expect(lines).toContainEqual(expect.objectContaining({ x0: 0, y0: 30, x1: 90, y1: 30 }))
    expect(lines).toContainEqual(expect.objectContaining({ x0: 30, y0: 0, x1: 30, y1: 90 }))
  })

  it('grows each line from its middle', () => {
    const { canvas, paint, lines } = setup()
    drawGridLines(canvas, paint, scale90, 0.5, STYLE)
    expect(lines).toContainEqual(expect.objectContaining({ x0: 22.5, y0: 30, x1: 67.5, y1: 30 }))
  })

  it('draws nothing at grow 0', () => {
    const { canvas, paint, lines } = setup()
    drawGridLines(canvas, paint, scale90, 0, STYLE)
    expect(lines).toHaveLength(0)
  })
})

describe('gridLineStyle', () => {
  it('takes the grid colours and the line widths from the theme', () => {
    expect(gridLineStyle(cobalt)).toEqual({
      frame: cobalt.components.grid.frame,
      box: cobalt.components.grid.boxLine,
      cell: cobalt.components.grid.cellLine,
      frameWidth: cobalt.shape.gridLine.outer,
      boxWidth: cobalt.shape.gridLine.box,
      cellWidth: cobalt.shape.gridLine.cell,
    })
  })
})
