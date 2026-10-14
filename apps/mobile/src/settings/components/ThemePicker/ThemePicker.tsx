import { useEffect, useState } from 'react'
import { Pressable, Text, View, type LayoutRectangle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import type { ThemePreference } from '@/theme/preference'
import { THEME_NAMES, THEMES } from '@/theme/themes/registry'
import { pressedStyles } from '@/theme/pressed.styles'
import { easeOut } from '@/utils/motion.utils'
import { INDICATOR_MS, SYSTEM_LABEL } from './ThemePicker.constants'
import { styles } from './ThemePicker.styles'

type ThemePickerProps = { value: ThemePreference; onChange(preference: ThemePreference): void }

const OPTIONS: readonly { preference: ThemePreference; label: string }[] = [
  { preference: 'system', label: SYSTEM_LABEL },
  ...THEME_NAMES.map((name) => ({ preference: name, label: THEMES[name].label })),
]

const HIDDEN: LayoutRectangle = { x: 0, y: 0, width: 0, height: 0 }

/**
 * The choices wrap over rows, so the indicator reads the frame of each segment. It slides to a new choice.
 * The first frame and Reduce Motion place it at once: Reanimated skips a timing with Reduce Motion on.
 */
export function ThemePicker({ value, onChange }: ThemePickerProps) {
  const [frames, setFrames] = useState<Partial<Record<ThemePreference, LayoutRectangle>>>({})
  const target = frames[value]
  const x = useSharedValue(HIDDEN.x)
  const y = useSharedValue(HIDDEN.y)
  const width = useSharedValue(HIDDEN.width)
  const height = useSharedValue(HIDDEN.height)
  useEffect(() => {
    if (target === undefined) return
    const first = width.get() === 0
    const to = (end: number) => (first ? end : withTiming(end, { duration: INDICATOR_MS, easing: easeOut }))
    x.set(to(target.x))
    y.set(to(target.y))
    width.set(to(target.width))
    height.set(to(target.height))
  }, [target, x, y, width, height])
  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: width.get() === 0 ? 0 : 1,
    width: width.get(),
    height: height.get(),
    transform: [{ translateX: x.get() }, { translateY: y.get() }],
  }))
  return (
    <View style={styles.track}>
      <Animated.View testID="theme-indicator" pointerEvents="none" style={[styles.indicator, indicatorStyle]} />
      {OPTIONS.map(({ preference, label }) => {
        const selected = preference === value
        return (
          <Pressable
            key={preference}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => onChange(preference)}
            onLayout={({ nativeEvent }) => setFrames((known) => ({ ...known, [preference]: nativeEvent.layout }))}
            style={({ pressed }) => [styles.segment, pressed && pressedStyles.pressed]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
