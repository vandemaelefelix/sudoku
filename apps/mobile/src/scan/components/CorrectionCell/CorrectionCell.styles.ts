import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

// One key per cell state, not Unistyles variants: the Jest mock of Unistyles drops variants.
export const styles = StyleSheet.create((theme) => ({
  cell: { position: 'absolute' },
  fill: { ...StyleSheet.absoluteFillObject },
  selected: { backgroundColor: theme.components.cell.selected },
  conflictFill: { backgroundColor: theme.components.cell.conflictFill },
  digit: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  given: { ...roleFont(theme.type.given), color: theme.components.cell.given },
  entry: { ...roleFont(theme.type.entry), color: theme.components.cell.entry },
  conflict: { color: theme.components.cell.conflict },
}))
