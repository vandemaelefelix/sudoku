import { useMemo } from 'react'
import { View } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { completeDigits } from '@sudoku/core'
import { NumberKey } from '@/game/components/NumberKey'
import { useEased } from '@/hooks/useEased'
import { useGameActions } from '@/game/hooks/useGameActions'
import { useGameState } from '@/game/hooks/useGameState'
import { KEY_ROWS } from './Keypad.constants'
import { styles } from './Keypad.styles'

export function Keypad() {
  const { board, notesMode } = useGameState()
  const { digit: enter } = useGameActions()
  const complete = useMemo(() => completeDigits(board), [board])
  const locked = board.status !== 'playing'
  const { theme } = useUnistyles()
  const opacity = useEased(locked ? theme.opacity.locked : 1)
  const lockStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }))
  return (
    <Animated.View testID="keypad" style={[styles.keypad, lockStyle]}>
      {KEY_ROWS.map((digits, row) => (
        <View key={digits[0]} testID={`keypad-row-${row}`} style={styles.row}>
          {digits.map((digit) => (
            <NumberKey
              key={digit}
              digit={digit}
              notesMode={notesMode}
              complete={complete.includes(digit)}
              disabled={locked}
              onPress={enter}
            />
          ))}
        </View>
      ))}
    </Animated.View>
  )
}
