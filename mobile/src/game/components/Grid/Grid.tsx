import { useMemo } from 'react'
import { View } from 'react-native'
import { BOXES } from '@sudoku/core'
import { Cell } from '@/game/components/Cell'
import { useCellViews } from '@/game/hooks/useCellViews'
import { useGameActions } from '@/game/hooks/useGameActions'
import { useGameState } from '@/game/hooks/useGameState'
import { useGridIntro } from '@/game/hooks/useGridIntro'
import { usePulse } from '@/game/hooks/usePulse'
import type { DigitSize } from '@/game/utils/cell.utils'
import { cellLabel } from '@/game/utils/cellLabel.utils'
import { hintHighlight } from '@/game/utils/hint.utils'
import { markOf } from '@/game/utils/mark.utils'
import { styles } from './Grid.styles'

const THREE = [0, 1, 2] as const

type GridProps = {
  /** false: a board to look at, for example a preview. VoiceOver skips it and no cell takes a tap. */
  interactive?: boolean
  digitSize?: DigitSize
}

/**
 * 81 cells in nine boxes. BOXES lists the cells of each box row by row. A pulse runs in the cells, not here.
 * An interactive grid enters: its lines are there at once, and the digits sweep in from the top left (useGridIntro).
 * The props default to {}: GameScreen.renders.test calls Grid() as a plain function.
 */
export function Grid({ interactive = true, digitSize = 'full' }: GridProps = {}) {
  const { board, move, hint } = useGameState()
  // The highlight keeps its identity while the hint does, so a clock tick or a selection makes no new views.
  const highlight = useMemo(() => hintHighlight(hint), [hint])
  const views = useCellViews(highlight)
  const { select } = useGameActions()
  const pulse = usePulse(board, move)
  const intro = useGridIntro()
  // Only the marked cell gets the mark props, so memo renders that cell and the cell of the mark before.
  const mark = interactive ? markOf(move) : null
  const drawCell = (cell: number) => {
    const view = views[cell]
    if (!view) return null
    const marked = mark !== null && mark.cell === cell
    return (
      <Cell
        key={cell}
        cell={cell}
        {...view}
        label={cellLabel(cell, view)}
        {...(interactive ? { pulse, intro } : {})}
        onSelect={select}
        interactive={interactive}
        digitSize={digitSize}
        markKind={marked ? mark.kind : undefined}
        markId={marked ? mark.id : undefined}
      />
    )
  }
  return (
    <View
      testID="grid"
      style={styles.frame}
      accessibilityElementsHidden={!interactive}
      importantForAccessibility={interactive ? 'auto' : 'no-hide-descendants'}
    >
      {THREE.map((band) => (
        <View key={band} style={styles.band}>
          {THREE.map((column) => {
            const box = band * 3 + column
            const boxCells = BOXES[box] ?? []
            return (
              <View key={box} testID={`box-${box}`} style={styles.box}>
                {THREE.map((row) => (
                  <View key={row} style={styles.row}>
                    {boxCells.slice(row * 3, row * 3 + 3).map(drawCell)}
                  </View>
                ))}
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}
