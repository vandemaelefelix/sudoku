import { contrastRatio } from './contrast.utils'
import type { Theme } from './theme.types'
import { daylight } from '@/theme/themes/daylight'
import { midnight } from '@/theme/themes/midnight'

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
  ...(['fill', 'peer', 'selected'] as const).map((fill): Pair => [
    `note on ${fill}`,
    (t) => t.components.cell.note,
    (t) => t.components.cell[fill],
  ]),
  ['key digit on key', (t) => t.components.key.digit, (t) => t.components.key.fill],
  ['key note digit on key', (t) => t.components.key.noteDigit, (t) => t.components.key.fill],
  ['text on segmented track', (t) => t.colors.text, (t) => t.components.segmented.track],
  ['muted on segmented track', (t) => t.colors.textMuted, (t) => t.components.segmented.track],
  ['text on segmented selection', (t) => t.colors.text, (t) => t.components.segmented.selected],
]

describe.each([daylight, midnight])('$name', (theme) => {
  it.each(TEXT_PAIRS)('%s meets WCAG AA (4.5 : 1)', (_label, foreground, background) => {
    expect(contrastRatio(foreground(theme), background(theme))).toBeGreaterThanOrEqual(4.5)
  })
})
