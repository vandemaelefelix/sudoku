import { StyleSheet } from 'react-native-unistyles'

// ADR-015, point 6: the lines are the gaps between boxes and cells, over the line colours.
export const styles = StyleSheet.create((theme) => ({
  frame: {
    flex: 1,
    padding: theme.shape.gridLine.outer,
    gap: theme.shape.gridLine.box,
    borderRadius: theme.shape.radius.sm,
    overflow: 'hidden',
    backgroundColor: theme.components.grid.frame,
  },
  band: { flex: 1, flexDirection: 'row', gap: theme.shape.gridLine.box },
  box: { flex: 1, gap: theme.shape.gridLine.cell, backgroundColor: theme.components.grid.cellLine },
  row: { flex: 1, flexDirection: 'row', gap: theme.shape.gridLine.cell },
}))
