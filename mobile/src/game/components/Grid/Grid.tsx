import { useMemo, useState } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'
import { BOXES } from '@sudoku/core'
import { Cell } from '@/game/components/Cell'
import { GridSelection } from '@/game/components/GridSelection'
import { useCellViews } from '@/game/hooks/useCellViews'
import { useGameActions } from '@/game/hooks/useGameActions'
import { useGameState } from '@/game/hooks/useGameState'
import { useGridIntro } from '@/game/hooks/useGridIntro'
import { usePulse } from '@/game/hooks/usePulse'
import type { DigitSize, HintHighlight } from '@/game/utils/cell.utils'
import { cellLabel } from '@/game/utils/cellLabel.utils'
import { hintHighlight } from '@/game/utils/hint.utils'
import { markOf } from '@/game/utils/mark.utils'
import { styles } from './Grid.styles'
import { useIntl } from '@/i18n/hooks/useIntl'

const THREE = [0, 1, 2] as const

type GridProps = {
  /** false: a board to look at, for example a preview. VoiceOver skips it and no cell takes a tap. */
  interactive?: boolean
  digitSize?: DigitSize
  /** A fixed highlight for a display grid, such as the example of a technique page. Else the grid marks the open hint. */
  highlight?: HintHighlight
}

/**
 * 81 cells in nine boxes. BOXES lists the cells of each box row by row. A pulse runs in the cells, not here.
 * An interactive grid enters: its lines are there at once, and the digits sweep in from the top left (useGridIntro).
 * The props default to {}: GameScreen.renders.test calls Grid() as a plain function.
 */
export function Grid({ interactive = true, digitSize = 'full', highlight }: GridProps = {}) {
  const { board, move, hint } = useGameState()
  // The highlight keeps its identity while the hint does, so a clock tick or a selection makes no new views.
  const hinted = useMemo(() => highlight ?? hintHighlight(hint), [highlight, hint])
  const views = useCellViews(hinted)
  const intl = useIntl()
  const { select } = useGameActions()
  const pulse = usePulse(board, move)
  const intro = useGridIntro()
  // Only the marked cell gets the mark props, so memo renders that cell and the cell of the mark before.
  const mark = interactive ? markOf(move) : null
  // The frame of the selected cell lies over the grid lines, so it needs the side of the grid.
  const [side, setSide] = useState(0)
  const measure = ({ nativeEvent }: LayoutChangeEvent) => setSide(nativeEvent.layout.width)
  const selected = views.findIndex((view) => view.fill === 'selected' || view.ring)
  const drawCell = (cell: number) => {
    const view = views[cell]
    if (!view) return null
    const marked = mark !== null && mark.cell === cell
    return (
      <Cell
        key={cell}
        cell={cell}
        {...view}
        label={cellLabel(intl, cell, view)}
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
    <View testID="grid-box" style={styles.grid} onLayout={measure}>
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
      {/* Outside the frame, which clips its corners. The frame stays inside the grid on its own. */}
      <GridSelection
        cell={selected === -1 ? null : selected}
        kind={views[selected]?.fill === 'selected' ? 'filled' : 'ring'}
        side={side}
      />
    </View>
  )
}
