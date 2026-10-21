import { useMemo } from 'react'
import { useConfirmReplace } from '@/game/hooks/useConfirmReplace'
import { createPuzzleStart, type PuzzleStart } from '@/game/utils/puzzleStart.utils'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { useOwner } from '@/storage/hooks/useOwner'

/** The puzzle start of this screen. The home, scan and game screens use it and keep only their navigation. */
export function usePuzzleStart(): PuzzleStart {
  const { puzzles } = useGameStorage()
  const owner = useOwner()
  const confirmReplace = useConfirmReplace()
  return useMemo(() => createPuzzleStart({ puzzles, owner, confirmReplace }), [puzzles, owner, confirmReplace])
}
