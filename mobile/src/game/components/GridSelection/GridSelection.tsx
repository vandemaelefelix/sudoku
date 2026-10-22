import { useUnistyles } from 'react-native-unistyles'
import { SelectionFrame } from '@/components/SelectionFrame'
import { cellLines } from '@/game/utils/grid.utils'
import { selectionFrame } from '@/utils/selectionFrame.utils'

type GridSelectionProps = {
  /** The selected cell, or null for none. */
  cell: number | null
  /** filled: the selected cell has its fill and the ring of the theme. ring: the selected-cell assist is off, a thin ring alone. */
  kind: 'filled' | 'ring'
  /** The side of the grid in points. 0 before the first layout. */
  side: number
}

/**
 * The selection frame of the game grid. It reads the theme itself, so a theme switch renders only this frame and not the
 * grid (ADR-015).
 */
export function GridSelection({ cell, kind, side }: GridSelectionProps) {
  const { theme } = useUnistyles()
  const width = kind === 'filled' ? theme.components.cell.selectedRingWidth : theme.shape.stroke.ring
  const rect =
    cell === null || side === 0 ? null : selectionFrame(cellLines(cell, side, theme.shape.gridLine), width, side)
  return <SelectionFrame rect={rect} width={width} />
}
