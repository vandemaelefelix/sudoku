import { useEffect } from 'react'
import { Pressable, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { pressedStyles } from '@/theme/pressed.styles'
import { easeOut } from '@/utils/motion.utils'
import { TOGGLE_MS } from './Toggle.constants'
import { styles } from './Toggle.styles'

type ToggleProps = {
  value: boolean
  onChange(on: boolean): void
  label: string
  hint?: string | undefined
  testID?: string | undefined
}

/**
 * A boxy toggle in the Op-art language (ADR-026): a rectangular track with a border and a square thumb that slides.
 * The thumb always differs from the track in colour, on and off, in both looks. With Reduce Motion the thumb jumps.
 */
export function Toggle({ value, onChange, label, hint, testID }: ToggleProps) {
  const { theme } = useUnistyles()
  const border = theme.components.button.outlineWidth
  // The thumb travels the width of the track inside its border, minus its own size and the gap on both sides.
  const { width, height, thumb } = theme.size.toggle
  const gap = (height - 2 * border - thumb) / 2
  const travel = width - 2 * border - thumb - 2 * gap
  const position = useSharedValue(value ? travel : 0)
  useEffect(() => {
    position.set(withTiming(value ? travel : 0, { duration: TOGGLE_MS, easing: easeOut }))
  }, [value, travel, position])
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: position.get() }] }))
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [styles.touch, pressed && pressedStyles.pressed]}
    >
      <View testID="toggle-track" style={[styles.track, value ? styles.trackOn : styles.trackOff]}>
        <Animated.View testID="toggle-thumb" style={[styles.thumb, value ? styles.thumbOn : styles.thumbOff, slide]} />
      </View>
    </Pressable>
  )
}
