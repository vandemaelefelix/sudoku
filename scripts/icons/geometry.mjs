// The icon design "Centred, in front of the waves", in a 100 × 100 design space.
// Colours from the Cobalt palette (ADR-021, ADR-025). The icon is a fixed image and does not follow the saved theme.

/** [centre y, amplitude] of the 4 waves. Each lower wave swings more, like the Op-art panel edge. */
export const WAVES = [
  [36.5, 1],
  [45.5, 1.6],
  [54.5, 2.2],
  [63.5, 2.8],
]
export const WAVE_PERIOD = 24
export const WAVE_WIDTH = 3
/** The 9: centre and ink height in design units. */
export const NINE = { cx: 50, cy: 50, height: 58 }
/** Design units of empty space between the 9 and a wave. */
export const KNOCKOUT = 3.5
/** Android shows the centre 72 dp of the 108 dp adaptive layer. */
export const ANDROID_SCALE = 72 / 108
/** The 66 dp safe circle of the 108 dp layer, as a radius in design units. */
export const SAFE_RADIUS = (33 / 108) * 100
/** A band across the top-right corner, at 45°. Its centre line is x - y = cx - cy. */
export const IOS_RIBBON = { cx: 88, cy: 12, length: 80, thickness: 11, textHeight: 5.5, rotate: 45 }
/** A horizontal strip below the scaled 9. A round launcher mask cuts its ends, which is intended. */
export const ANDROID_RIBBON = { cx: 50, cy: 76.5, length: 120, thickness: 8, textHeight: 4.5, rotate: 0 }

/** ground null: transparent, iOS or the launcher draws the ground. */
export const PALETTES = {
  light: { ground: '#ffffff', digit: '#0f1d5c', waves: '#1f3fd1', ribbon: '#1f3fd1' },
  dark: { ground: null, digit: '#ffffff', waves: '#c3cbef', ribbon: '#1f3fd1' },
  tinted: { ground: null, digit: '#ffffff', waves: '#b3b3b3', ribbon: '#ffffff' },
  mono: { ground: null, digit: '#ffffff', waves: '#ffffff', ribbon: '#ffffff' },
}

const r = (n) => +n.toFixed(2)

/** A sine wave from x0 to x1, one point per unit. Same formula as wavePoints in the app (ADR-021). */
export function wavePath(y, amp, x0, x1) {
  const points = []
  for (let x = x0; x <= x1; x += 1) points.push(`${r(x)} ${r(y - amp * Math.sin((2 * Math.PI * x) / WAVE_PERIOD))}`)
  return `M${points.join(' L')}`
}

/** The band rectangle with the text cut out. Draw it with fill-rule evenodd, so the text shows the layer below. */
export function ribbonPath(text, { cx, cy, length, thickness }) {
  const x = cx - length / 2
  const y = cy - thickness / 2
  return `M${r(x)} ${r(y)} H${r(x + length)} V${r(y + thickness)} H${r(x)} Z ${text.d}`
}

export function iconSvg({ palette, layers, nine, scale = 1, ribbon = null }) {
  const p = PALETTES[palette]
  // Wide enough that the waves still run past the edge after the scale.
  const x0 = 50 - 52 / scale
  const x1 = 50 + 52 / scale
  const defs = []
  const content = []
  if (layers.includes('waves')) {
    // The mask is in the coordinates of the scaled group, the same as the 9.
    defs.push(
      `<mask id="knockout" maskUnits="userSpaceOnUse" x="-100" y="-100" width="300" height="300">` +
        `<rect x="-100" y="-100" width="300" height="300" fill="#ffffff"/>` +
        `<path d="${nine}" fill="#000000" stroke="#000000" stroke-width="${2 * KNOCKOUT}" stroke-linejoin="round"/>` +
        `</mask>`,
    )
    const d = WAVES.map(([y, amp]) => wavePath(y, amp, x0, x1)).join(' ')
    content.push(
      `<path d="${d}" fill="none" stroke="${p.waves}" stroke-width="${WAVE_WIDTH}" stroke-linecap="round" mask="url(#knockout)"/>`,
    )
  }
  if (layers.includes('nine')) content.push(`<path d="${nine}" fill="${p.digit}"/>`)
  const ground = layers.includes('ground') ? `<rect width="100" height="100" fill="${p.ground}"/>` : ''
  const body =
    scale === 1
      ? content.join('')
      : `<g transform="translate(50 50) scale(${scale}) translate(-50 -50)">${content.join('')}</g>`
  const band = ribbon
    ? `<path d="${ribbon.d}" fill="${p.ribbon}" fill-rule="evenodd" transform="rotate(${ribbon.rotate} ${ribbon.cx} ${ribbon.cy})"/>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${defs.join('')}</defs>${ground}${body}${band}</svg>`
}
