import { useMemo } from 'react'
import { useAssists } from '@/game/hooks/useAssists'
import { useGameState } from '@/game/hooks/useGameState'
import { cellViews, type CellView } from '@/game/utils/cell.utils'

/** The view of each cell, row by row. It changes only with the board or the assists, never with the time. */
export function useCellViews(): CellView[] {
  const { board } = useGameState()
  const assists = useAssists()
  return useMemo(() => cellViews(board, assists), [board, assists])
}
