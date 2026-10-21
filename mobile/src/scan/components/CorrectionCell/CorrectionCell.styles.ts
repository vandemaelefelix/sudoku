import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

// One key per cell state, not Unistyles variants: the Jest mock of Unistyles drops variants.
export const styles = StyleSheet.create((theme) => ({
  cell: { position: 'absolute' },
  fill: { ...StyleSheet.absoluteFillObject },
  // The selected cell has a fill and a ring in both looks (ADR-026).
  selected: {
    backgroundColor: theme.components.cell.selected,
    borderWidth: theme.components.cell.selectedRingWidth,
    borderColor: theme.components.cell.ring,
  },
  /** An open cell to check takes the warning surface, the colour of its ring. */
  selectedCheck: { backgroundColor: theme.colors.warningSurface },
  conflictFill: { backgroundColor: theme.components.cell.conflictFill },
  // The solved wave covers the cell and lies under the digit. Its opacity comes from the pulse.
  wave: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.accent },
  digit: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  given: { ...roleFont(theme.type.given), color: theme.components.cell.given },
  entry: { ...roleFont(theme.type.entry), color: theme.components.cell.entry },
  conflict: { color: theme.components.cell.conflict },
  // The solution takes the face of the givens, so the full grid reads as one set of digits.
  solution: { ...roleFont(theme.type.given), position: 'absolute', color: theme.colors.textMuted, opacity: 0.6 },
  confidence: { ...roleFont(theme.type.eyebrow), position: 'absolute', fontSize: 8, color: theme.colors.textMuted },
  // The note role and the note corner: a hint reads as a small note of the solution, never as a digit of the player.
  hint: {
    ...roleFont(theme.type.note),
    position: 'absolute',
    top: theme.size.noteInset,
    right: theme.size.noteInset,
    color: theme.colors.textMuted,
  },
  confidenceLow: { color: theme.colors.warningText },
}))
