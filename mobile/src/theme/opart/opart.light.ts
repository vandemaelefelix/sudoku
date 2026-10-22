import type { Theme } from '@/theme/theme.types'
import { rgb } from './opart.colour.utils'
import { SHARED_PALETTE as w, type OpartPalette } from './opart.types'

/** What an appearance decides: the colours and the parts of the components that hold colours. The rest of the theme is shared. */
export type Look = Pick<Theme, 'statusBar' | 'scrollIndicator' | 'colors' | 'elevation' | 'components'>

/** The Light appearance (ADR-025): a white page, one ink colour and coloured content. */
export function lightLook(p: OpartPalette): Look {
  const colors: Theme['colors'] = {
    background: w.white,
    surface: w.white,
    text: p.ink,
    textMuted: p.muted,
    accent: p.accent,
    onAccent: w.white,
    accentSoft: p.tint150,
    line: p.tint200,
    lineStrong: p.accent,
    danger: p.danger,
    dangerSurface: p.dangerSurface,
    warning: p.warning,
    warningText: p.warningText,
    warningSurface: p.warningSurface,
    shadow: p.ink,
    scrim: w.whiteScrim,
    scrimStrong: w.whiteScrimStrong,
  }
  const shadow = rgb(p.ink)
  return {
    statusBar: 'dark',
    scrollIndicator: 'black',
    colors,
    elevation: { key: 'none', sheet: `0 24px 60px -20px rgba(${shadow},0.3)`, panel: 'none' },
    components: {
      // A flat card in the accent with a white frame and a white shine: one colour, no rainbow.
      finishCard: {
        top: colors.accent,
        middle: colors.accent,
        bottom: colors.accent,
        text: w.white,
        textMuted: p.tint150,
        given: w.white,
        entry: p.tint300,
        line: w.whiteLine,
        boxLine: w.whiteBoxLine,
        shine: w.whiteShine,
        shineCool: w.whiteShineSoft,
        shineWarm: w.whiteShineSoft,
        shineClear: w.whiteClear,
        badge: w.white,
        badgeText: colors.accent,
        radius: 14,
        badgeRadius: 2,
        buttonRadius: 0,
        frame: w.whiteFrame,
        // A close contact shadow and a long soft one lift the card off the white page.
        shadow: `0 1px 2px rgba(${shadow},0.25), 0 10px 20px -6px rgba(${shadow},0.3), 0 32px 64px -24px rgba(${shadow},0.45)`,
      },
      grid: { frame: colors.lineStrong, boxLine: colors.lineStrong, cellLine: colors.line },
      cell: {
        fill: colors.surface,
        peer: p.tint100,
        same: p.tint200,
        // Lighter than the same-number cells, so its notes in muted text pass. The accent ring marks it.
        selected: p.tint150,
        conflictFill: colors.dangerSurface,
        ring: colors.accent,
        given: colors.text,
        entry: p.entry,
        conflict: colors.danger,
        conflictHatch: null,
        note: colors.textMuted,
        // The strongest tint: clearly above the same-number cell, and none of the hint fills.
        selectedTile: p.tint300,
        selectedNote: colors.text,
        // The steps of the accent tints. A pattern cell holds notes, and muted notes on tint200 fall below 4.5 : 1 in Forest.
        // The target holds only the ghost digit, so it takes tint200.
        hintFocusFill: p.tint100,
        hintPatternFill: p.tint150,
        hintTargetFill: p.tint200,
        hintSupport: colors.accent,
        hintStrike: colors.danger,
        hintStrikeWidth: 2,
        // A pencil grey, so the answer never reads as a support digit in the accent.
        hintGhost: colors.text,
        hintGhostOpacity: 0.55,
      },
      key: { fill: p.tint100, digit: colors.text, noteDigit: colors.accent },
      // Boxy toggle: an accent track with a white thumb when on, an outlined track with an accent thumb when off.
      switch: {
        on: colors.accent,
        off: colors.surface,
        border: colors.line,
        thumbOn: w.white,
        thumbOff: colors.accent,
      },
      button: {
        primary: colors.accent,
        onPrimary: w.white,
        second: colors.surface,
        outline: colors.accent,
        outlineWidth: 1.5,
        radius: 0,
      },
      panel: { fill: colors.surface, radius: 0, border: colors.line, borderWidth: 0, key: p.tint100, keyRadius: 0 },
      checkRing: { color: colors.warning, round: true },
      pulse: { waveOpacity: 0.25, popScale: 1.3 },
      summary: { border: colors.lineStrong, borderWidth: 1.5, radius: 0, rule: colors.lineStrong, ruleWidth: 1.5 },
    },
  }
}
