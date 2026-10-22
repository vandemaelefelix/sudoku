import { useMemo } from 'react'
import { useAssists } from '@/game/hooks/useAssists'
import { useGameState } from '@/game/hooks/useGameState'
import { cellViews, type CellView, type HintHighlight } from '@/game/utils/cell.utils'

/**
 * The view of each cell, row by row. It changes only with the board, the assists or the highlight, never with the time.
 * Keep the identity of the highlight while it does not change, or every render makes the views again.
 */
export function useCellViews(highlight: HintHighlight | null = null): CellView[] {
  const { board } = useGameState()
  const { assists } = useAssists()
  return useMemo(() => cellViews(board, assists, highlight), [board, assists, highlight])
}
