import { readFileSync } from 'node:fs'
import opentype from 'opentype.js'

const FONT_DIR = new URL('../../apps/mobile/assets/fonts/', import.meta.url)

// The fonts the app bundles (ADR-021). The icon uses the same 9 as a given digit of the Op-art theme.
export const FONTS = {
  serif: new URL('InstrumentSerif-Regular.ttf', FONT_DIR),
  mono: new URL('IBMPlexMono-Medium.ttf', FONT_DIR),
}

export function loadFont(url) {
  const bytes = readFileSync(url)
  return opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
}

/** The outline of `text` as SVG path data. Its ink box is centred on (cx, cy) and is `height` units high. */
export function outline(font, text, { cx, cy, height }) {
  const probe = font.getPath(text, 0, 0, 100).getBoundingBox()
  const size = (100 * height) / (probe.y2 - probe.y1)
  const box = font.getPath(text, 0, 0, size).getBoundingBox()
  const path = font.getPath(text, cx - (box.x1 + box.x2) / 2, cy - (box.y1 + box.y2) / 2, size)
  return { d: path.toPathData(3), box: path.getBoundingBox() }
}
