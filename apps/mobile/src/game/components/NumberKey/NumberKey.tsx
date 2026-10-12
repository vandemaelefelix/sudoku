import { useEffect } from 'react'
import { Pressable, Text } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useAnimatedTheme } from 'react-native-unistyles/reanimated'
import type { Digit } from '@sudoku/core'
import { KEY_DONE } from '@/game/constants/keypad.constants'
import { keyDoneLook } from '@/game/utils/keypad.utils'
import { styles } from './NumberKey.styles'

type NumberKeyProps = {
  digit: Digit
  notesMode: boolean
  complete: boolean
  disabled: boolean
  onPress(digit: Digit): void
}

export function NumberKey({ digit, notesMode, complete, disabled, onPress }: NumberKeyProps) {
  const reduceMotion = useReducedMotion()
  const theme = useAnimatedTheme()
  // A key that is complete on mount (a resumed game) starts at the end state and does not animate.
  const progress = useSharedValue(complete ? 1 : 0)
  useEffect(() => {
    progress.set(complete ? withTiming(1, { duration: KEY_DONE.durationMs, easing: Easing.linear }) : 0)
  }, [complete, progress])
  const look = useAnimatedStyle(() => {
    const { opacity, scale } = keyDoneLook(progress.get(), reduceMotion, theme.get().opacity.disabled)
    return { opacity, transform: [{ scale }] }
  })
  const name = `${notesMode ? 'Note' : 'Enter'} ${digit}`
  const off = disabled || complete
  return (
    <Animated.View testID={`number-key-${digit}`} style={look}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={complete ? `${name}, all nine placed` : name}
        accessibilityState={{ disabled: off }}
        disabled={off}
        onPress={() => onPress(digit)}
        style={[styles.key, !complete && styles.raised]}
      >
        <Text allowFontScaling={false} style={notesMode ? styles.noteDigit : styles.digit}>
          {digit}
        </Text>
      </Pressable>
    </Animated.View>
  )
}
