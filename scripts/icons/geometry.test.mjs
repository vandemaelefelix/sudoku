import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ANDROID_RIBBON, ANDROID_SCALE, IOS_RIBBON, KNOCKOUT, NINE, SAFE_RADIUS, WAVE_WIDTH, WAVES, iconSvg, wavePath } from './geometry.mjs'
import { FONTS, loadFont, outline } from './glyph.mjs'

const serif = loadFont(FONTS.serif)
const mono = loadFont(FONTS.mono)
const nine = outline(serif, '9', NINE)

// A point of the design space after the Android layer scale around the centre.
const scaled = (x, y) => [50 + (x - 50) * ANDROID_SCALE, 50 + (y - 50) * ANDROID_SCALE]
const corners = ({ x1, y1, x2, y2 }) => [[x1, y1], [x2, y1], [x1, y2], [x2, y2]]

test('the 9 is centred and has the design height', () => {
  const { x1, y1, x2, y2 } = nine.box
  assert.ok(Math.abs((x1 + x2) / 2 - 50) < 0.01)
  assert.ok(Math.abs((y1 + y2) / 2 - 50) < 0.01)
  assert.ok(Math.abs(y2 - y1 - NINE.height) < 0.01)
})

test('the waves are centred on the 9', () => {
  const ys = WAVES.map(([y]) => y)
  assert.equal((Math.min(...ys) + Math.max(...ys)) / 2, 50)
})

test('a wave runs past both edges', () => {
  const d = wavePath(50, 1, -2, 102)
  assert.match(d, /^M-2 /)
  assert.match(d, /L102 /)
})

test('the scaled 9 and its knockout stay inside the Android safe circle', () => {
  const { x1, y1, x2, y2 } = nine.box
  const box = { x1: x1 - KNOCKOUT, y1: y1 - KNOCKOUT, x2: x2 + KNOCKOUT, y2: y2 + KNOCKOUT }
  for (const [x, y] of corners(box).map(([x, y]) => scaled(x, y))) {
    assert.ok(Math.hypot(x - 50, y - 50) < SAFE_RADIUS, `corner ${x}, ${y}`)
  }
})

test('the Android strip text stays inside the safe circle and below the scaled 9', () => {
  const text = outline(mono, 'DEV', { cx: ANDROID_RIBBON.cx, cy: ANDROID_RIBBON.cy, height: ANDROID_RIBBON.textHeight })
  for (const [x, y] of corners(text.box)) assert.ok(Math.hypot(x - 50, y - 50) < SAFE_RADIUS, `corner ${x}, ${y}`)
  const [, nineBottom] = scaled(0, nine.box.y2 + KNOCKOUT)
  assert.ok(ANDROID_RIBBON.cy - ANDROID_RIBBON.thickness / 2 > nineBottom)
})

test('the iOS corner ribbon clears the 9 and every wave crest', () => {
  // The ribbon centre line is x - y = c. A point is clear when x - y is below the near band edge.
  const c = IOS_RIBBON.cx - IOS_RIBBON.cy
  const nearEdge = c - (IOS_RIBBON.thickness / 2) * Math.SQRT2
  const { x1, y1, x2, y2 } = nine.box
  const box = { x1: x1 - KNOCKOUT, y1: y1 - KNOCKOUT, x2: x2 + KNOCKOUT, y2: y2 + KNOCKOUT }
  for (const [x, y] of corners(box)) assert.ok(x - y < nearEdge, `9 corner ${x}, ${y}`)
  for (const [y, amp] of WAVES) assert.ok(100 - (y - amp - WAVE_WIDTH / 2) < nearEdge, `wave at ${y}`)
})

test('the iOS ribbon text stays inside the rounded corner', () => {
  // iOS rounds the corner with a radius of about 22.37 % of the icon.
  const r = 22.37
  const text = outline(mono, 'DEV', { cx: IOS_RIBBON.cx, cy: IOS_RIBBON.cy, height: IOS_RIBBON.textHeight })
  const half = Math.hypot(text.box.x2 - text.box.x1, text.box.y2 - text.box.y1) / 2
  assert.ok(Math.hypot(IOS_RIBBON.cx - (100 - r), IOS_RIBBON.cy - r) + half < r)
})

test('the light ground is opaque and the other palettes have no ground', () => {
  const svg = iconSvg({ palette: 'light', layers: ['ground', 'waves', 'nine'], nine: nine.d })
  assert.match(svg, /<rect width="100" height="100" fill="#ffffff"\/>/)
  const dark = iconSvg({ palette: 'dark', layers: ['waves', 'nine'], nine: nine.d })
  assert.doesNotMatch(dark, /<rect width="100" height="100"/)
})

test('the waves stop around the 9 with a mask', () => {
  const svg = iconSvg({ palette: 'light', layers: ['waves', 'nine'], nine: nine.d })
  assert.match(svg, /<mask id="knockout"/)
  assert.match(svg, new RegExp(`stroke-width="${2 * KNOCKOUT}"`))
})
