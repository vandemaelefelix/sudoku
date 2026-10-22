import { contrastRatio } from './contrast.utils'
import { mixHex } from './opart/opart.colour.utils'
import type { Theme } from './theme.types'
import { COLOUR_THEMES, THEMES, THEME_NAMES } from '@/theme/themes/registry'

type Pair = [label: string, foreground: (t: Theme) => string, background: (t: Theme) => string]

/** Every text colour on every fill it is drawn on. Notes never sit on the same-number fill: only empty cells hold notes. */
const TEXT_PAIRS: Pair[] = [
  ['text on background', (t) => t.colors.text, (t) => t.colors.background],
  ['text on surface', (t) => t.colors.text, (t) => t.colors.surface],
  ['muted on background', (t) => t.colors.textMuted, (t) => t.colors.background],
  ['muted on surface', (t) => t.colors.textMuted, (t) => t.colors.surface],
  ['accent on background', (t) => t.colors.accent, (t) => t.colors.background],
  ['accent on surface', (t) => t.colors.accent, (t) => t.colors.surface],
  ['accent on accent soft', (t) => t.colors.accent, (t) => t.colors.accentSoft],
  ['on-accent on accent', (t) => t.colors.onAccent, (t) => t.colors.accent],
  ['warning text on warning surface', (t) => t.colors.warningText, (t) => t.colors.warningSurface],
  ['danger on surface', (t) => t.colors.danger, (t) => t.colors.surface],
  ['conflict on conflict fill', (t) => t.components.cell.conflict, (t) => t.components.cell.conflictFill],
  ...(['fill', 'peer', 'same', 'selected'] as const).flatMap((fill): Pair[] => [
    [`given on ${fill}`, (t) => t.components.cell.given, (t) => t.components.cell[fill]],
    [`entry on ${fill}`, (t) => t.components.cell.entry, (t) => t.components.cell[fill]],
  ]),
  ...(['fill', 'peer', 'selected', 'hintFocus'] as const).map((fill): Pair => [
    `note on ${fill}`,
    (t) => t.components.cell.note,
    (t) => t.components.cell[fill],
  ]),
  ...(['given', 'entry'] as const).map((digit): Pair => [
    `${digit} on hintFocus`,
    (t) => t.components.cell[digit],
    (t) => t.components.cell.hintFocus,
  ]),
  // A segmented control and a tab bar draw their selected cell with the fill of the selected grid cell.
  ['accent label on the selected cell', (t) => t.colors.accent, (t) => t.components.cell.selected],
  ['muted label on a segment', (t) => t.colors.textMuted, (t) => t.colors.surface],
  [
    'primary button text on the primary button',
    (t) => t.components.button.onPrimary,
    (t) => t.components.button.primary,
  ],
  ['text on the second button', (t) => t.colors.text, (t) => t.components.button.second],
  ['text on the panel', (t) => t.colors.text, (t) => t.components.panel.fill],
  ['muted on the panel', (t) => t.colors.textMuted, (t) => t.components.panel.fill],
  ['warning text on the panel', (t) => t.colors.warningText, (t) => t.components.panel.fill],
  ['danger on the panel', (t) => t.colors.danger, (t) => t.components.panel.fill],
  ['text on a pad key', (t) => t.colors.text, (t) => t.components.panel.key],
  ['muted on a pad key', (t) => t.colors.textMuted, (t) => t.components.panel.key],
  ['key digit on key', (t) => t.components.key.digit, (t) => t.components.key.fill],
  ['key note digit on key', (t) => t.components.key.noteDigit, (t) => t.components.key.fill],
  ['finish card text on its lightest stop', (t) => t.components.finishCard.text, (t) => t.components.finishCard.bottom],
  [
    'finish card muted text on its lightest stop',
    (t) => t.components.finishCard.textMuted,
    (t) => t.components.finishCard.bottom,
  ],
  ['finish card given on its middle stop', (t) => t.components.finishCard.given, (t) => t.components.finishCard.middle],
  ['finish card entry on its middle stop', (t) => t.components.finishCard.entry, (t) => t.components.finishCard.middle],
  [
    'finish card badge text on the badge',
    (t) => t.components.finishCard.badgeText,
    (t) => t.components.finishCard.badge,
  ],
]

const ALL_THEMES = [...THEME_NAMES.map((name) => THEMES[name]), ...THEME_NAMES.map((name) => COLOUR_THEMES[name])]

/** The colour of a stripe of the hatch over the conflict fill. The Light themes have no hatch: the fill alone. */
function hatchStripe(t: Theme): string {
  const { conflictFill, conflictHatch } = t.components.cell
  return conflictHatch === null ? conflictFill : mixHex(conflictFill, conflictHatch.color, conflictHatch.opacity)
}

/** Shapes that carry meaning need 3 : 1 (WCAG 1.4.11): the thumb of a toggle against its track, the ring of a cell against its fill. */
const SHAPE_PAIRS: Pair[] = [
  ['thumb of a toggle that is on, on its track', (t) => t.components.switch.thumbOn, (t) => t.components.switch.on],
  ['thumb of a toggle that is off, on its track', (t) => t.components.switch.thumbOff, (t) => t.components.switch.off],
  // The worst case of the hatch: a white digit over a stripe, which is the stripe colour laid over the conflict fill.
  ['conflict digit on a stripe of the hatch', (t) => t.components.cell.conflict, hatchStripe],
  ['selection ring on the selected cell', (t) => t.components.cell.ring, (t) => t.components.cell.selected],
  // A hint role can land on a plain cell, inside a focus unit or on the selected cell.
  ...(['hintFocusLine', 'hintPattern', 'hintSupport', 'hintStrike', 'hintTarget'] as const).flatMap((role) =>
    (['fill', 'hintFocus', 'selected'] as const).map((fill): Pair => [
      `${role} on ${fill}`,
      (t) => t.components.cell[role],
      (t) => t.components.cell[fill],
    ]),
  ),
]

describe.each(ALL_THEMES)('$name $appearance', (theme) => {
  it.each(TEXT_PAIRS)('%s meets WCAG AA (4.5 : 1)', (_label, foreground, background) => {
    expect(contrastRatio(foreground(theme), background(theme))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(SHAPE_PAIRS)('%s meets 3 : 1', (_label, foreground, background) => {
    expect(contrastRatio(foreground(theme), background(theme))).toBeGreaterThanOrEqual(3)
  })
})

describe('the six themes', () => {
  it('are three colourways in two appearances', () => {
    expect(ALL_THEMES).toHaveLength(6)
    expect(ALL_THEMES.map((theme) => `${theme.name}/${theme.appearance}`)).toEqual([
      'cobalt/light',
      'forest/light',
      'bordeaux/light',
      'cobalt/colour',
      'forest/colour',
      'bordeaux/colour',
    ])
  })

  it('keep the conflict amber and the check ring apart in Colour', () => {
    for (const theme of Object.values(COLOUR_THEMES)) {
      expect(theme.components.cell.conflictFill).not.toBe(theme.components.checkRing.color)
    }
  })

  it('draw Light content on a white page and Colour content on the accent', () => {
    for (const theme of Object.values(THEMES)) expect(theme.colors.background).toBe('#ffffff')
    for (const theme of Object.values(COLOUR_THEMES)) {
      expect(theme.colors.background).not.toBe('#ffffff')
      expect(theme.colors.text).toBe('#ffffff')
    }
  })
})
