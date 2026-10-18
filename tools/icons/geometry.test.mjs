import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ACCENT,
  ANDROID_RIBBON,
  ANDROID_SCALE,
  DIGITS,
  DIGIT_HEIGHT,
  IOS_RIBBON,
  LINE_POSITIONS,
  LINE_WIDTH,
  PALETTES,
  TINT_CELLS,
  cellCentre,
  cellRect,
  iconSvg,
  mix,
} from './geometry.mjs'
import { FONTS, loadFont, outline } from './glyph.mjs'

const serif = loadFont(FONTS.serif)
const mono = loadFont(FONTS.mono)
// The Android launcher shows the centre 72 dp of 108 dp. A round mask keeps a circle of 66 dp.
const SAFE_RADIUS = (33 / 108) * 100

const placed = DIGITS.flatMap((cells, row) =>
  cells.flatMap((char, col) =>
    char === null
      ? []
      : [{ char, row, col, glyph: outline(serif, char, { ...cellCentre(row, col), height: DIGIT_HEIGHT }) }],
  ),
)
const scaled = (x, y) => [50 + (x - 50) * ANDROID_SCALE, 50 + (y - 50) * ANDROID_SCALE]
const corners = ({ x1, y1, x2, y2 }) => [
  [x1, y1],
  [x2, y1],
  [x1, y2],
  [x2, y2],
]

test('the grid has six different digits and three tinted cells without a digit', () => {
  const chars = placed.map((d) => d.char)
  assert.equal(chars.length, 6)
  assert.equal(new Set(chars).size, 6)
  assert.equal(TINT_CELLS.length, 3)
  for (const [row, col] of TINT_CELLS) assert.equal(DIGITS[row][col], null)
})

test('each digit is centred in its cell and has the design height', () => {
  for (const { char, row, col, glyph } of placed) {
    const { cx, cy } = cellCentre(row, col)
    const { x1, y1, x2, y2 } = glyph.box
    assert.ok(Math.abs((x1 + x2) / 2 - cx) < 0.01, `${char} x`)
    assert.ok(Math.abs((y1 + y2) / 2 - cy) < 0.01, `${char} y`)
    assert.ok(Math.abs(y2 - y1 - DIGIT_HEIGHT) < 0.01, `${char} height`)
  }
})

test('each digit stays inside the area of its cell', () => {
  for (const { char, row, col, glyph } of placed) {
    const cell = cellRect(row, col)
    const { x1, y1, x2, y2 } = glyph.box
    assert.ok(x1 > cell.x && x2 < cell.x + cell.width, `${char} x`)
    assert.ok(y1 > cell.y && y2 < cell.y + cell.height, `${char} y`)
  }
})

test('the lines are 16 px of 1024 and sit on the third lines', () => {
  assert.equal(LINE_WIDTH, 1.5625)
  assert.deepEqual(
    LINE_POSITIONS.map((n) => +n.toFixed(3)),
    [33.333, 66.667],
  )
})

test('the cells and the lines cover the icon without overlap', () => {
  let area = 0
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const { width, height } = cellRect(row, col)
      area += width * height
    }
  }
  assert.ok(Math.abs(area + 4 * 100 * LINE_WIDTH - 4 * LINE_WIDTH ** 2 - 10000) < 0.001)
})

test('mix blends towards the other colour', () => {
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080')
  assert.equal(PALETTES.light.tint.color, mix(ACCENT, '#ffffff', 0.2))
  assert.equal(PALETTES.dark.ground, mix(ACCENT, '#000000', 0.16))
})

test('the scaled grid and its digits stay inside the Android visible area of 72 dp', () => {
  const lo = 50 - 50 * ANDROID_SCALE
  const hi = 50 + 50 * ANDROID_SCALE
  for (const { char, glyph } of placed) {
    for (const [x, y] of corners(glyph.box).map(([cx, cy]) => scaled(cx, cy))) {
      assert.ok(x >= lo && x <= hi && y >= lo && y <= hi, `${char} corner ${x}, ${y}`)
    }
  }
})

test('the Android strip text stays inside the safe circle', () => {
  const text = outline(mono, 'DEV', { cx: ANDROID_RIBBON.cx, cy: ANDROID_RIBBON.cy, height: ANDROID_RIBBON.textHeight })
  for (const [x, y] of corners(text.box)) assert.ok(Math.hypot(x - 50, y - 50) < SAFE_RADIUS, `corner ${x}, ${y}`)
})

test('the iOS ribbon text stays inside the rounded corner', () => {
  // iOS rounds the corner with a radius of about 22.37 % of the icon.
  const r = 22.37
  const text = outline(mono, 'DEV', { cx: IOS_RIBBON.cx, cy: IOS_RIBBON.cy, height: IOS_RIBBON.textHeight })
  const half = Math.hypot(text.box.x2 - text.box.x1, text.box.y2 - text.box.y1) / 2
  assert.ok(Math.hypot(IOS_RIBBON.cx - (100 - r), IOS_RIBBON.cy - r) + half < r)
})

test('the light and dark grounds are opaque and the other palettes have no ground', () => {
  const digits = placed.map((d) => d.glyph)
  const layers = ['ground', 'cells', 'lines', 'digits']
  assert.match(iconSvg({ palette: 'light', layers, digits }), /<rect width="100" height="100" fill="#1f3fd1"\/>/)
  assert.match(iconSvg({ palette: 'dark', layers, digits }), /<rect width="100" height="100" fill="#1a35b0"\/>/)
  assert.doesNotMatch(
    iconSvg({ palette: 'tinted', layers: ['cells', 'lines', 'digits'], digits }),
    /<rect width="100" height="100"/,
  )
})
