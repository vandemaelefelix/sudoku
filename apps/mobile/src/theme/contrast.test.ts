import { contrastRatio } from './contrast.utils'
import type { Theme } from './theme.types'
import { THEMES } from '@/theme/themes/registry'

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
  ['muted on conflict fill', (t) => t.colors.textMuted, (t) => t.components.cell.conflictFill],
  ...(['fill', 'peer', 'same', 'selected'] as const).flatMap((fill): Pair[] => [
    [`given on ${fill}`, (t) => t.components.cell.given, (t) => t.components.cell[fill]],
    [`entry on ${fill}`, (t) => t.components.cell.entry, (t) => t.components.cell[fill]],
  ]),
  ...(['fill', 'peer', 'selected'] as const).map((fill): Pair => [
    `note on ${fill}`,
    (t) => t.components.cell.note,
    (t) => t.components.cell[fill],
  ]),
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
  ['text on segmented track', (t) => t.colors.text, (t) => t.components.segmented.track],
  ['muted on segmented track', (t) => t.colors.textMuted, (t) => t.components.segmented.track],
  ['text on segmented selection', (t) => t.colors.text, (t) => t.components.segmented.selected],
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

describe.each(Object.values(THEMES))('$name', (theme) => {
  it.each(TEXT_PAIRS)('%s meets WCAG AA (4.5 : 1)', (_label, foreground, background) => {
    expect(contrastRatio(foreground(theme), background(theme))).toBeGreaterThanOrEqual(4.5)
  })
})
