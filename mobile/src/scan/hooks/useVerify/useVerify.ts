import { useMemo, useState } from 'react'
import { verifyGrid, type GridVerdict } from '@sudoku/core'
import type { CorrectedGrid } from '@/scan/utils/correctionEdit.utils'

export type Verify = {
  /** null while the grid is not full, or the player has not tapped Check. */
  verdict: GridVerdict | null
  verify(): void
}

/**
 * The verify state of a full grid. After the first tap the verdict follows every edit, so fixing the last wrong cell
 * solves the grid. The solver runs only for a full grid that the player verified, never before the first tap.
 */
export function useVerify(grid: CorrectedGrid, full: boolean): Verify {
  const [tapped, setTapped] = useState(false)
  // The tap belongs to a full grid. React renders again at once when state is set during the render of its own component.
  if (!full && tapped) setTapped(false)
  const verdict = useMemo(() => (tapped && full ? verifyGrid(grid.givens, grid.entries) : null), [tapped, full, grid])
  return useMemo(() => ({ verdict, verify: () => setTapped(true) }), [verdict])
}
