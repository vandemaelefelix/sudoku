import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

// One key per cell state, not Unistyles variants: the Jest mock of Unistyles drops variants.
export const styles = StyleSheet.create((theme) => ({
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  plain: { backgroundColor: theme.components.cell.fill },
  peer: { backgroundColor: theme.components.cell.peer },
  same: { backgroundColor: theme.components.cell.same },
  conflict: { backgroundColor: theme.components.cell.conflictFill },
  selected: { backgroundColor: theme.components.cell.selected },
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
  given: { ...roleFont(theme.type.given), fontSize: theme.type.given.scale, color: theme.components.cell.given },
  entry: { ...roleFont(theme.type.entry), fontSize: theme.type.entry.scale, color: theme.components.cell.entry },
  wrong: { ...roleFont(theme.type.entry), fontSize: theme.type.entry.scale, color: theme.components.cell.conflict },
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
