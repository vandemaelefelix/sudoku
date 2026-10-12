import { View } from 'react-native'
import { MAX_MISTAKES } from '@sudoku/core'
import { useGameState } from '@/game/hooks/useGameState'
import { styles } from './MistakeDots.styles'

const DOTS = Array.from({ length: MAX_MISTAKES }, (_, dot) => dot)

/** One dot fills for each mistake. */
export function MistakeDots() {
  const { mistakes } = useGameState().board
  return (
    <View style={styles.dots} accessible accessibilityLabel={`${mistakes} of ${MAX_MISTAKES} mistakes`}>
      {DOTS.map((dot) => (
        <View
          key={dot}
          testID={`mistake-dot-${dot}`}
          style={[styles.dot, dot < mistakes ? styles.filled : styles.empty]}
        />
      ))}
    </View>
  )
}
