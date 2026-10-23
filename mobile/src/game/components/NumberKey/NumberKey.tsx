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
import { KEY_DONE, NOTE_SWAP_SCALE } from '@/game/constants/keypad.constants'
import { useEased } from '@/hooks/useEased'
import { keyDoneLook } from '@/game/utils/keypad.utils'
import { easeOut } from '@/utils/motion.utils'
import { styles } from './NumberKey.styles'
import { useIntl } from '@/i18n/hooks/useIntl'

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
  // An undo opens the key again. The key then only fades back: a pop on the way back would read as a new completion.
  const reopening = useSharedValue(false)
  useEffect(() => {
    reopening.set(!complete)
    progress.set(
      complete
        ? withTiming(1, { duration: KEY_DONE.durationMs, easing: Easing.linear })
        : withTiming(0, { duration: KEY_DONE.reopenMs, easing: easeOut }),
    )
  }, [complete, progress, reopening])
  const look = useAnimatedStyle(() => {
    const { opacity, scale } = keyDoneLook(
      progress.get(),
      reduceMotion || reopening.get(),
      theme.get().opacity.disabled,
    )
    return { opacity, transform: [{ scale }] }
  })
  // 0 shows the number, 1 the note. The two labels crossfade, and each scales a little toward the size of the other.
  const intl = useIntl()
  const notes = useEased(notesMode ? 1 : 0)
  const digitStyle = useAnimatedStyle(() => {
    const scale = reduceMotion ? 1 : 1 - (1 - NOTE_SWAP_SCALE) * notes.get()
    return { opacity: 1 - notes.get(), transform: [{ scale }] }
  })
  const noteStyle = useAnimatedStyle(() => {
    const scale = reduceMotion ? 1 : 1 / NOTE_SWAP_SCALE - (1 / NOTE_SWAP_SCALE - 1) * notes.get()
    return { opacity: notes.get(), transform: [{ scale }] }
  })
  const name = intl.formatMessage({ id: notesMode ? 'game.key.note' : 'game.key.enter' }, { digit })
  const off = disabled || complete
  return (
    <Animated.View testID={`number-key-${digit}`} style={look}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={complete ? intl.formatMessage({ id: 'game.key.complete' }, { name }) : name}
        accessibilityState={{ disabled: off }}
        disabled={off}
        onPress={() => onPress(digit)}
        style={[styles.key, !complete && styles.raised]}
      >
        <Animated.Text allowFontScaling={false} style={[styles.digit, digitStyle]}>
          {digit}
        </Animated.Text>
        <Animated.View style={[styles.noteLayer, noteStyle]} pointerEvents="none">
          <Text allowFontScaling={false} style={styles.noteDigit}>
            {digit}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}
