import { memo } from 'react'
import { Text, View } from 'react-native'
import { GRID_CELLS, valueAt, type Game } from '@sudoku/core'
import { columnOf, rowOf } from '@/utils/grid.utils'
import { styles } from './CardGrid.styles'

const SIDE = Math.sqrt(GRID_CELLS)
const ROWS = Array.from({ length: SIDE }, (_row, row) =>
  Array.from({ length: SIDE }, (_column, column) => row * SIDE + column),
)

function edgeStyles(cell: number) {
  const column = columnOf(cell)
  const row = rowOf(cell)
  return [
    column === 2 || column === 5 ? styles.boxRight : null,
    row === 2 || row === 5 ? styles.boxBottom : null,
    column === 8 ? styles.lastColumn : null,
    row === 8 ? styles.lastRow : null,
  ]
}

/** The solved grid at card size, givens and entries in two styles. VoiceOver skips it: the card label says the result. */
export const CardGrid = memo(function CardGrid({ board }: { board: Game }) {
  return (
    <View
      testID="card-grid"
      style={styles.grid}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {ROWS.map((cells, row) => (
        <View key={cells[0]} testID={`card-row-${row}`} style={styles.row}>
          {cells.map((cell) => (
            <View key={cell} style={[styles.cell, ...edgeStyles(cell)]}>
              <Text testID={`card-cell-${cell}`} style={board.givens[cell] === 0 ? styles.entry : styles.given}>
                {valueAt(board, cell)}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
})
