import type { Theme } from '@/theme/theme.types'
import type { Look } from './opart.light'
import { mixHex, rgb } from './opart.colour.utils'
import { SHARED_PALETTE as w, type OpartPalette } from './opart.types'

/** The amber of danger text and danger fills outside the grid, for example the blocked-play message. It passes on the page. */
const DANGER = '#ffc94d'

/**
 * The hatch of a conflict cell in the Colour look (ADR-026): white stripes over the peer fill, with a white digit. The
 * opacity is the largest that keeps the white digit at 4.5 : 1 on a stripe in every colourway: the first mock-up had 0.55.
 */
const CONFLICT_HATCH = { color: '#ffffff', opacity: 0.2, width: 1.6, pitch: 5 }
/** The page is the accent, this much darker, so light content stays calm on it (ADR-026). */
const PAGE_DARKEN = 0.16

/**
 * The Colour appearance (ADR-026): the accent is the page and the content is white or light. Every surface is white laid over
 * the page, so one hue carries the whole screen. The values come from the accent and the entry tint of the colourway.
 */
export function colourLook(p: OpartPalette): Look {
  const page = mixHex(p.accent, '#000000', PAGE_DARKEN)
  // white(k): the page with white laid over it, k from 0 to 1.
  const white = (k: number) => mixHex(page, w.white, k)
  const pageRgb = rgb(page)
  // Muted text also sits on a key, which is lighter than the page, so it is lighter than the 0.72 of the first mock-up.
  const muted = white(0.8)
  const colors: Theme['colors'] = {
    background: page,
    surface: page,
    text: w.white,
    textMuted: muted,
    accent: w.white,
    onAccent: page,
    accentSoft: white(0.15),
    line: white(0.3),
    lineStrong: white(0.55),
    // Danger text is amber. A red would clash with the red of Bordeaux.
    danger: DANGER,
    dangerSurface: DANGER,
    // The uncertain-cell ring is white and dashed. Only the conflict is amber, so the two never mix.
    warning: w.white,
    warningText: w.white,
    warningSurface: white(0.15),
    shadow: '#000000',
    scrim: `rgba(${pageRgb},0.55)`,
    scrimStrong: `rgba(${pageRgb},0.94)`,
  }
  // A white card on the coloured page: its text and lines are the page colour.
  const cardMuted = mixHex(page, w.white, 0.25)
  const cardLine = `rgba(${pageRgb},0.22)`
  const cardBoxLine = `rgba(${pageRgb},0.6)`
  return {
    statusBar: 'light',
    scrollIndicator: 'white',
    colors,
    elevation: { key: 'none', sheet: '0 24px 60px -20px rgba(0,0,0,0.5)', panel: 'none' },
    components: {
      finishCard: {
        top: w.white,
        middle: w.white,
        bottom: w.white,
        text: page,
        textMuted: cardMuted,
        given: page,
        entry: p.entry,
        line: cardLine,
        boxLine: cardBoxLine,
        shine: w.whiteShine,
        shineCool: w.whiteShineSoft,
        shineWarm: w.whiteShineSoft,
        shineClear: w.whiteClear,
        badge: page,
        badgeText: w.white,
        radius: 14,
        badgeRadius: 2,
        buttonRadius: 0,
        frame: `rgba(${pageRgb},0.3)`,
        shadow: '0 1px 2px rgba(0,0,0,0.35), 0 10px 20px -6px rgba(0,0,0,0.4), 0 32px 64px -24px rgba(0,0,0,0.55)',
      },
      grid: { frame: white(0.9), boxLine: white(0.9), cellLine: white(0.3) },
      cell: {
        fill: page,
        peer: white(0.07),
        same: white(0.15),
        // The selected cell is a lighter tint of the page with a white ring. Its digits keep their colours.
        selected: white(0.2),
        // A conflict cell keeps the peer fill and gets the hatch, so it never reads as the accent or as a selection.
        conflictFill: white(0.07),
        ring: w.white,
        given: w.white,
        entry: p.colourEntry,
        conflict: w.white,
        conflictHatch: CONFLICT_HATCH,
        // Notes also sit on the selected fill, where muted text is too faint, so they are nearly white.
        note: white(0.9),
        selectedRingWidth: 2,
      },
      key: { fill: white(0.14), digit: w.white, noteDigit: w.white },
      // Boxy toggle: a white track with a page-coloured thumb when on, an outlined track with a white thumb when off.
      switch: { on: w.white, off: page, border: white(0.3), thumbOn: page, thumbOff: w.white },
      button: {
        primary: w.white,
        onPrimary: page,
        second: page,
        outline: w.white,
        outlineWidth: 1.5,
        radius: 0,
      },
      panel: { fill: white(0.06), radius: 0, border: white(0.3), borderWidth: 0, key: white(0.14), keyRadius: 0 },
      checkRing: { color: colors.warning, round: true },
      pulse: { waveOpacity: 0.25, popScale: 1.3 },
      summary: { border: w.white, borderWidth: 1.5, radius: 0, rule: w.white, ruleWidth: 1.5 },
    },
  }
}
