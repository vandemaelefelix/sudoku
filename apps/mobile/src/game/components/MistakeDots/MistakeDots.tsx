import * as Haptics from 'expo-haptics'
import { useEffect } from 'react'
import { View } from 'react-native'
import { MAX_MISTAKES } from '@sudoku/core'
import { useGameState } from '@/game/hooks/useGameState'
import { styles } from './MistakeDots.styles'

const DOTS = Array.from({ length: MAX_MISTAKES }, (_, dot) => dot)

/** One dot fills for each mistake. A warning haptic goes with each new mistake. */
export function MistakeDots() {
  const { board, move } = useGameState()
  const { mistakes } = board
  useEffect(() => {
    if (!move?.mistake) return
    // A phone without a haptic engine rejects the call. The game goes on without the warning.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined)
  }, [move])
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
