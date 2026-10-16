import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

// A row of sudoku-like cells (ADR-026): square corners, cells divided by the box-line weight inside the frame of the grid.
// No filled track. The selected cell has the fill and the ring of the selected cell of the grid.
// The frame holds only the border. Its content box is the `cells` view, so every position below is measured from the same edge.
export const styles = StyleSheet.create((theme) => ({
  frame: {
    borderWidth: theme.components.button.outlineWidth,
    borderColor: theme.components.grid.frame,
    backgroundColor: theme.colors.surface,
  },
  cells: { flexDirection: 'row', minHeight: theme.size.touch },
  // No border on a segment: a border would change its flex width, and the cells must all have the same width as the indicator.
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // A divider is a line of its own, centred on the edge between two cells.
  divider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: theme.components.button.outlineWidth,
    backgroundColor: theme.components.grid.boxLine,
  },
  // The indicator is exactly one cell: the same top, bottom and width as the cell, with the ring drawn inside it.
  indicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.components.cell.selected,
    borderWidth: theme.shape.stroke.ring,
    borderColor: theme.components.cell.ring,
  },
  label: { ...roleFont(theme.type.label), fontSize: theme.type.label.scale, color: theme.colors.textMuted },
  labelSelected: { color: theme.colors.accent },
}))
