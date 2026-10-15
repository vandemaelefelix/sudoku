import { useEffect, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { pressedStyles } from '@/theme/pressed.styles'
import { easeOut } from '@/utils/motion.utils'
import { INDICATOR_MS } from './SegmentedControl.constants'
import { styles } from './SegmentedControl.styles'

type SegmentedControlProps<T extends string> = {
  options: readonly { value: T; label: string }[]
  value: T
  onChange(value: T): void
  /** The test id of the sliding indicator. The cells view has the same id with the suffix -cells. */
  indicatorTestID: string
  /** tabs: the control is a tab bar for VoiceOver, with the role tab on each cell. */
  kind?: 'buttons' | 'tabs'
}

/**
 * A row of cells in the grid language (ADR-026). The cells have equal widths, the width of the content box of the frame
 * divided by the number of cells, so the indicator cannot drift from them. The indicator is one cell: it moves with one
 * timing, the same as the Reduce Motion rule of Reanimated. The first layout and a new width place it at once.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  indicatorTestID,
  kind = 'buttons',
}: SegmentedControlProps<T>) {
  const { theme } = useUnistyles()
  const [inner, setInner] = useState(0)
  const cell = inner / options.length
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  const x = useSharedValue(0)
  const width = useSharedValue(0)
  const placedFor = useRef(0)
  useEffect(() => {
    if (cell === 0) return
    const target = index * cell
    width.set(cell)
    // The first layout and a new cell width place the indicator at once. A new choice slides it, x and width together.
    if (placedFor.current !== cell) {
      placedFor.current = cell
      x.set(target)
      return
    }
    x.set(withTiming(target, { duration: INDICATOR_MS, easing: easeOut }))
  }, [cell, index, x, width])
  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: width.get() === 0 ? 0 : 1,
    width: width.get(),
    transform: [{ translateX: x.get() }],
  }))
  const line = theme.components.button.outlineWidth
  return (
    <View accessibilityRole={kind === 'tabs' ? 'tablist' : undefined} style={styles.frame}>
      <View
        testID={`${indicatorTestID}-cells`}
        style={styles.cells}
        onLayout={({ nativeEvent }) => setInner(nativeEvent.layout.width)}
      >
        {cell > 0 &&
          options
            .slice(1)
            .map((option, i) => (
              <View
                key={option.value}
                pointerEvents="none"
                style={[styles.divider, { left: (i + 1) * cell - line / 2 }]}
              />
            ))}
        <Animated.View testID={indicatorTestID} pointerEvents="none" style={[styles.indicator, indicatorStyle]} />
        {options.map(({ value: option, label }) => {
          const selected = option === value
          return (
            <Pressable
              key={option}
              accessibilityRole={kind === 'tabs' ? 'tab' : 'button'}
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              onPress={() => onChange(option)}
              style={({ pressed }) => [styles.segment, pressed && pressedStyles.pressed]}
            >
              <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
