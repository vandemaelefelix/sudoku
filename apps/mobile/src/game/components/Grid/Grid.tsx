import { View } from 'react-native'
import { BOXES } from '@sudoku/core'
import { Cell } from '@/game/components/Cell'
import { useCellViews } from '@/game/hooks/useCellViews'
import { useGameActions } from '@/game/hooks/useGameActions'
import { useGameState } from '@/game/hooks/useGameState'
import { usePulse } from '@/game/hooks/usePulse'
import { cellLabel } from '@/game/utils/cellLabel.utils'
import { styles } from './Grid.styles'

const THREE = [0, 1, 2] as const

/** 81 cells in nine boxes. BOXES lists the cells of each box row by row. A pulse runs in the cells, not here. */
export function Grid() {
  const views = useCellViews()
  const { select } = useGameActions()
  const { board, move } = useGameState()
  const pulse = usePulse(board, move)
  const drawCell = (cell: number) => {
    const view = views[cell]
    if (!view) return null
    return <Cell key={cell} cell={cell} {...view} label={cellLabel(cell, view)} pulse={pulse} onSelect={select} />
  }
  return (
    <View testID="grid" style={styles.frame}>
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
