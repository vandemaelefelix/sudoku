import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

// One key per cell state, not Unistyles variants: the Jest mock of Unistyles drops variants.
export const styles = StyleSheet.create((theme) => ({
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  plain: { backgroundColor: theme.components.cell.fill },
  peer: { backgroundColor: theme.components.cell.peer },
  same: { backgroundColor: theme.components.cell.same },
  conflict: { backgroundColor: theme.components.cell.conflictFill },
  // The selected cell has a fill. Its frame lies on the grid lines, drawn by the grid (ADR-026, amendment of 2026-10-22).
  selected: { backgroundColor: theme.components.cell.selected },
  wave: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
    backgroundColor: theme.colors.accent,
  },
  flash: { position: 'absolute', inset: 0, pointerEvents: 'none' },
  fillLayer: { position: 'absolute', inset: 0 },
  flashHint: { backgroundColor: theme.colors.accent },
  flashUndo: { backgroundColor: theme.colors.textMuted },
  given: { ...roleFont(theme.type.given), fontSize: theme.type.given.scale, color: theme.components.cell.given },
  entry: { ...roleFont(theme.type.entry), fontSize: theme.type.entry.scale, color: theme.components.cell.entry },
  wrong: { ...roleFont(theme.type.entry), fontSize: theme.type.entry.scale, color: theme.components.cell.conflict },
  // A small cell uses the note size for its digits, as in the canvas preview.
  givenSmall: { ...roleFont(theme.type.given), fontSize: theme.type.note.scale, color: theme.components.cell.given },
  entrySmall: { ...roleFont(theme.type.entry), fontSize: theme.type.note.scale, color: theme.components.cell.entry },
  wrongSmall: { ...roleFont(theme.type.entry), fontSize: theme.type.note.scale, color: theme.components.cell.conflict },
  notes: {
    position: 'absolute',
    top: theme.size.noteInset,
    right: theme.size.noteInset,
    bottom: theme.size.noteInset,
    left: theme.size.noteInset,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  // The hint roles (ADR-032): a fill over the cell fill, in lightness steps. No outline, so the grid lines stay as they are.
  hintLayer: { position: 'absolute', inset: 0, pointerEvents: 'none' },
  hintFocusFill: { backgroundColor: theme.components.cell.hintFocusFill },
  hintPatternFill: { backgroundColor: theme.components.cell.hintPatternFill },
  hintTargetFill: { backgroundColor: theme.components.cell.hintTargetFill },
  hintSupport: { color: theme.components.cell.hintSupport },
  ghost: {
    ...roleFont(theme.type.entry),
    fontSize: theme.type.entry.scale,
    color: theme.components.cell.hintGhost,
    opacity: theme.components.cell.hintGhostOpacity,
  },
  noteStrike: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    height: theme.components.cell.hintStrikeWidth,
    backgroundColor: theme.components.cell.hintStrike,
    transform: [{ rotate: '-35deg' }],
  },
  noteSlot: { width: '33.33%', height: '33.33%', alignItems: 'center', justifyContent: 'center' },
  note: { ...roleFont(theme.type.note), fontSize: theme.type.note.scale, color: theme.components.cell.note },
}))
