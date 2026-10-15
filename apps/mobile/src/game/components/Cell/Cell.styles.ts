import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

// One key per cell state, not Unistyles variants: the Jest mock of Unistyles drops variants.
export const styles = StyleSheet.create((theme) => ({
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  plain: { backgroundColor: theme.components.cell.fill },
  peer: { backgroundColor: theme.components.cell.peer },
  same: { backgroundColor: theme.components.cell.same },
  conflict: { backgroundColor: theme.components.cell.conflictFill },
  // In Colour the selected cell also has a ring (ADR-026). In Light selectedRingWidth is 0.
  selected: {
    backgroundColor: theme.components.cell.selected,
    borderWidth: theme.components.cell.selectedRingWidth,
    borderColor: theme.components.cell.ring,
  },
  ring: { borderWidth: theme.shape.stroke.ring, borderColor: theme.components.cell.ring },
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
  noteSlot: { width: '33.33%', height: '33.33%', alignItems: 'center', justifyContent: 'center' },
  note: { ...roleFont(theme.type.note), fontSize: theme.type.note.scale, color: theme.components.cell.note },
}))
