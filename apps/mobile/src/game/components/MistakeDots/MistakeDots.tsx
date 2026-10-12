import { View } from 'react-native'
import { MAX_MISTAKES } from '@sudoku/core'
import { useGame } from '@/game/hooks/useGame'
import { styles } from './MistakeDots.styles'

const DOTS = Array.from({ length: MAX_MISTAKES }, (_, dot) => dot)

/** One dot fills for each mistake. */
export function MistakeDots() {
  const { game } = useGame()
  return (
    <View style={styles.dots} accessible accessibilityLabel={`${game.mistakes} of ${MAX_MISTAKES} mistakes`}>
      {DOTS.map((dot) => (
        <View
          key={dot}
          testID={`mistake-dot-${dot}`}
          style={[styles.dot, dot < game.mistakes ? styles.filled : styles.empty]}
        />
      ))}
    </View>
  )
}
