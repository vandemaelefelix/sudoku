import resvg from '@resvg/resvg-js'
import {
  ANDROID_RIBBON,
  ANDROID_SCALE,
  DIGITS,
  DIGIT_HEIGHT,
  IOS_RIBBON,
  cellCentre,
  iconSvg,
  ribbonPath,
} from './geometry.mjs'
import { FONTS, loadFont, outline } from './glyph.mjs'

const { Resvg } = resvg

function ribbonFor(mono, spec) {
  const text = outline(mono, 'DEV', { cx: spec.cx, cy: spec.cy, height: spec.textHeight })
  return { ...spec, d: ribbonPath(text, spec) }
}

/** Every PNG of the app icon and the favicon (ADR-022). */
export function buildIcons() {
  const serif = loadFont(FONTS.serif)
  const digits = DIGITS.flatMap((cells, row) =>
    cells.flatMap((char, col) =>
      char === null ? [] : [outline(serif, char, { ...cellCentre(row, col), height: DIGIT_HEIGHT })],
    ),
  )
  const mono = loadFont(FONTS.mono)
  const iosRibbon = ribbonFor(mono, IOS_RIBBON)
  const androidRibbon = ribbonFor(mono, ANDROID_RIBBON)
  const all = ['ground', 'cells', 'lines', 'digits']
  const marks = ['cells', 'lines', 'digits']

  const variant = (folder, dev) => [
    {
      file: `${folder}/ios-light.png`,
      size: 1024,
      svg: iconSvg({ palette: 'light', layers: all, digits, ribbon: dev ? iosRibbon : null }),
    },
    {
      file: `${folder}/ios-dark.png`,
      size: 1024,
      svg: iconSvg({ palette: 'dark', layers: all, digits, ribbon: dev ? iosRibbon : null }),
    },
    {
      file: `${folder}/ios-tinted.png`,
      size: 1024,
      svg: iconSvg({ palette: 'tinted', layers: marks, digits, ribbon: dev ? iosRibbon : null }),
    },
    {
      file: `${folder}/android-foreground.png`,
      size: 1024,
      svg: iconSvg({
        palette: 'light',
        layers: marks,
        digits,
        scale: ANDROID_SCALE,
        ribbon: dev ? androidRibbon : null,
      }),
    },
    {
      file: `${folder}/android-monochrome.png`,
      size: 1024,
      svg: iconSvg({
        palette: 'mono',
        layers: ['lines', 'digits'],
        digits,
        scale: ANDROID_SCALE,
        ribbon: dev ? androidRibbon : null,
      }),
    },
  ]

  return [
    ...variant('production', false),
    ...variant('development', true),
    // Both variants use this background: the accent, drawn by hand for the full 108 dp layer.
    {
      file: 'production/android-background.png',
      size: 1024,
      svg: iconSvg({ palette: 'light', layers: ['ground'], digits }),
    },
    { file: 'favicon.png', size: 48, svg: iconSvg({ palette: 'light', layers: all, digits }) },
  ]
}

/** Renders one icon. pixels: RGBA bytes, row by row. */
export function renderPng({ svg, size }) {
  const image = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render()
  return { width: image.width, height: image.height, pixels: image.pixels, png: image.asPng() }
}
