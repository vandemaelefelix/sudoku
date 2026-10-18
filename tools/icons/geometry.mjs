// The icon design "Scatter with digits", in a 100 × 100 design space.
// Colours from the Cobalt palette (ADR-021, ADR-025). The icon is a fixed image and does not follow the saved theme.

export const ACCENT = '#1f3fd1'
/** Width of a white grid line: 16 px of the 1024 px icon. */
export const LINE_WIDTH = (16 / 1024) * 100
/** Ink height of a digit. */
export const DIGIT_HEIGHT = 23
/** The digit of each cell, by row. null is a cell with no digit. Each digit appears once. */
export const DIGITS = [
  ['5', null, '7'],
  ['8', '2', null],
  [null, '6', '9'],
]
/** The tinted cells as [row, column]. The tint has no digit. */
export const TINT_CELLS = [
  [0, 1],
  [1, 2],
  [2, 0],
]
/** Android shows the centre 72 dp of the 108 dp adaptive layer. */
export const ANDROID_SCALE = 72 / 108
/**
 * A band across the bottom-left corner, at 45°, over the empty tinted cell. Its centre line is x - y = cx - cy.
 * clearance: design units of empty ground between the band and the marks, so a cut digit does not show through the letters.
 */
export const IOS_RIBBON = { cx: 12, cy: 88, length: 80, thickness: 11, textHeight: 5.5, rotate: 45, clearance: 2.5 }
/**
 * A short plate over the empty tinted cell at the top centre of the scaled grid. No digit lies under it.
 * The cell centre is (50, 27.8) after the scale, and the plate is as wide as the cell.
 */
export const ANDROID_RIBBON = {
  cx: 50,
  cy: 50 - (100 / 3) * ANDROID_SCALE,
  length: 20,
  thickness: 8,
  textHeight: 4.5,
  rotate: 0,
  clearance: 0,
}

const channel = (hex, i) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16)

/** The colour `amount` of the way from `from` to `to`. */
export function mix(from, to, amount) {
  const out = [0, 1, 2].map((i) => Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * amount))
  return `#${out.map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

/**
 * ground null: transparent, iOS or the launcher draws the ground.
 * tint is a colour with an opacity, so that a grey icon can use white at a low opacity.
 */
export const PALETTES = {
  light: {
    ground: ACCENT,
    tint: { color: mix(ACCENT, '#ffffff', 0.2), opacity: 1 },
    line: { color: '#ffffff', opacity: 1 },
    digit: '#ffffff',
    ribbon: '#ffffff',
  },
  dark: {
    ground: mix(ACCENT, '#000000', 0.16),
    tint: { color: '#ffffff', opacity: 0.12 },
    line: { color: '#ffffff', opacity: 0.3 },
    digit: '#ffffff',
    ribbon: '#ffffff',
  },
  tinted: {
    ground: null,
    tint: { color: '#ffffff', opacity: 0.2 },
    line: { color: '#b3b3b3', opacity: 1 },
    digit: '#ffffff',
    ribbon: '#ffffff',
  },
  mono: {
    ground: null,
    tint: { color: '#ffffff', opacity: 0 },
    line: { color: '#ffffff', opacity: 1 },
    digit: '#ffffff',
    ribbon: '#ffffff',
  },
}

const r = (n) => +n.toFixed(2)
const THIRD = 100 / 3

/** The centre of a cell, in design units. */
export const cellCentre = (row, col) => ({ cx: (col + 0.5) * THIRD, cy: (row + 0.5) * THIRD })

/** The centre of the two inner lines, in design units. */
export const LINE_POSITIONS = [THIRD, 2 * THIRD]

/** The area of a cell between the grid lines. The cells and the lines do not overlap, so a line with opacity has one colour. */
export function cellRect(row, col) {
  const half = LINE_WIDTH / 2
  const x1 = col * THIRD + (col > 0 ? half : 0)
  const x2 = (col + 1) * THIRD - (col < 2 ? half : 0)
  const y1 = row * THIRD + (row > 0 ? half : 0)
  const y2 = (row + 1) * THIRD - (row < 2 ? half : 0)
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

/** The band rectangle with the text cut out. Draw it with fill-rule evenodd, so the text shows the layer below. */
export function ribbonPath(text, { cx, cy, length, thickness }) {
  const x = cx - length / 2
  const y = cy - thickness / 2
  return `M${r(x)} ${r(y)} H${r(x + length)} V${r(y + thickness)} H${r(x)} Z ${text.d}`
}

const rect = ({ x, y, width, height }, fill, opacity) =>
  `<rect x="${r(x)}" y="${r(y)}" width="${r(width)}" height="${r(height)}" fill="${fill}"${opacity === 1 ? '' : ` fill-opacity="${opacity}"`}/>`

/** digits: the path data of each digit, as [{ d }] in the order of DIGITS from the top left. */
export function iconSvg({ palette, layers, digits, scale = 1, ribbon = null }) {
  const p = PALETTES[palette]
  const content = []
  if (layers.includes('cells')) {
    for (const [row, col] of TINT_CELLS) content.push(rect(cellRect(row, col), p.tint.color, p.tint.opacity))
  }
  if (layers.includes('lines')) {
    // The vertical lines stop at the horizontal lines, so a line with opacity has one colour at a crossing.
    const half = LINE_WIDTH / 2
    const edges = [0, ...LINE_POSITIONS.flatMap((at) => [at - half, at + half]), 100]
    for (const at of LINE_POSITIONS) {
      content.push(rect({ x: 0, y: at - half, width: 100, height: LINE_WIDTH }, p.line.color, p.line.opacity))
      for (let i = 0; i < edges.length; i += 2) {
        content.push(
          rect(
            { x: at - half, y: edges[i], width: LINE_WIDTH, height: edges[i + 1] - edges[i] },
            p.line.color,
            p.line.opacity,
          ),
        )
      }
    }
  }
  if (layers.includes('digits')) for (const { d } of digits) content.push(`<path d="${d}" fill="${p.digit}"/>`)
  const ground = layers.includes('ground') ? `<rect width="100" height="100" fill="${p.ground}"/>` : ''
  const scaled =
    scale === 1
      ? content.join('')
      : `<g transform="translate(50 50) scale(${scale}) translate(-50 -50)">${content.join('')}</g>`
  const body = ribbon
    ? `<mask id="clearance" maskUnits="userSpaceOnUse" x="-100" y="-100" width="300" height="300">` +
      `<rect x="-100" y="-100" width="300" height="300" fill="#ffffff"/>` +
      `<rect x="${r(ribbon.cx - ribbon.length / 2)}" y="${r(ribbon.cy - ribbon.thickness / 2 - ribbon.clearance)}" width="${ribbon.length}" height="${r(ribbon.thickness + 2 * ribbon.clearance)}" fill="#000000" transform="rotate(${ribbon.rotate} ${ribbon.cx} ${ribbon.cy})"/>` +
      `</mask><g mask="url(#clearance)">${scaled}</g>`
    : scaled
  const band = ribbon
    ? `<path d="${ribbon.d}" fill="${p.ribbon}" fill-rule="evenodd" transform="rotate(${ribbon.rotate} ${ribbon.cx} ${ribbon.cy})"/>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${ground}${body}${band}</svg>`
}
