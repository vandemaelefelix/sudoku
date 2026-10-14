import resvg from '@resvg/resvg-js'
import { ANDROID_RIBBON, ANDROID_SCALE, IOS_RIBBON, NINE, iconSvg, ribbonPath } from './geometry.mjs'
import { FONTS, loadFont, outline } from './glyph.mjs'

const { Resvg } = resvg

function ribbonFor(mono, spec) {
  const text = outline(mono, 'DEV', { cx: spec.cx, cy: spec.cy, height: spec.textHeight })
  return { d: ribbonPath(text, spec), rotate: spec.rotate, cx: spec.cx, cy: spec.cy }
}

/** Every PNG of the app icon, the splash and the favicon (ADR-022). */
export function buildIcons() {
  const nine = outline(loadFont(FONTS.serif), '9', NINE).d
  const mono = loadFont(FONTS.mono)
  const iosRibbon = ribbonFor(mono, IOS_RIBBON)
  const androidRibbon = ribbonFor(mono, ANDROID_RIBBON)
  const all = ['ground', 'waves', 'nine']
  const marks = ['waves', 'nine']

  const variant = (folder, dev) => [
    { file: `${folder}/ios-light.png`, size: 1024, svg: iconSvg({ palette: 'light', layers: all, nine, ribbon: dev ? iosRibbon : null }) },
    { file: `${folder}/ios-dark.png`, size: 1024, svg: iconSvg({ palette: 'dark', layers: marks, nine, ribbon: dev ? iosRibbon : null }) },
    { file: `${folder}/ios-tinted.png`, size: 1024, svg: iconSvg({ palette: 'tinted', layers: marks, nine, ribbon: dev ? iosRibbon : null }) },
    {
      file: `${folder}/android-foreground.png`,
      size: 1024,
      svg: iconSvg({ palette: 'light', layers: ['nine'], nine, scale: ANDROID_SCALE, ribbon: dev ? androidRibbon : null }),
    },
    {
      file: `${folder}/android-monochrome.png`,
      size: 1024,
      svg: iconSvg({ palette: 'mono', layers: marks, nine, scale: ANDROID_SCALE, ribbon: dev ? androidRibbon : null }),
    },
  ]

  return [
    ...variant('production', false),
    ...variant('development', true),
    // The waves in the background layer keep the knockout of the 9 in the foreground layer.
    { file: 'production/android-background.png', size: 1024, svg: iconSvg({ palette: 'light', layers: ['ground', 'waves'], nine, scale: ANDROID_SCALE }) },
    { file: 'splash/splash-light.png', size: 1024, svg: iconSvg({ palette: 'light', layers: marks, nine }) },
    { file: 'splash/splash-dark.png', size: 1024, svg: iconSvg({ palette: 'dark', layers: marks, nine }) },
    { file: 'favicon.png', size: 48, svg: iconSvg({ palette: 'light', layers: all, nine }) },
  ]
}

/** Renders one icon. pixels: RGBA bytes, row by row. */
export function renderPng({ svg, size }) {
  const image = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render()
  return { width: image.width, height: image.height, pixels: image.pixels, png: image.asPng() }
}
