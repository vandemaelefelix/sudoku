import { Pressable } from 'react-native'
import Animated, { FadeIn, ReduceMotion, useAnimatedStyle } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { useEased } from '@/hooks/useEased'
import { pressedStyles } from '@/theme/pressed.styles'
import { easeOut } from '@/utils/motion.utils'
import { COMPACT_MAX_SCALE, LABEL_FADE_MS } from './PanelButton.constants'
import { styles } from './PanelButton.styles'

type PanelButtonProps = {
  testID?: string
  label: string
  /** primary: the main action of the panel. second: the other action, outlined or on a key fill per theme. */
  kind: 'primary' | 'second'
  onPress?: (() => void) | undefined
  disabled?: boolean
  /** Takes the free width of its row. */
  grow?: boolean
  accessibilityHint?: string | undefined
  /** For a toggle such as Solve. */
  pressed?: boolean
  /** A new label fades in, so the button keeps its place while its text changes. */
  animateLabel?: boolean
  /** The height of a touch target, for a row of buttons in a small panel such as the hint card. */
  compact?: boolean
}

/** A button of the correction panel, in the button tokens of the theme. It fades between enabled and disabled. */
export function PanelButton({
  testID,
  label,
  kind,
  onPress,
  disabled = false,
  grow = false,
  accessibilityHint,
  pressed,
  animateLabel = false,
  compact = false,
}: PanelButtonProps) {
  const { theme } = useUnistyles()
  const opacity = useEased(disabled ? theme.opacity.disabled : 1)
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }))
  return (
    <Animated.View
      testID={testID === undefined ? undefined : `${testID}-fade`}
      style={[grow && styles.grow, fadeStyle]}
    >
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityHint={accessibilityHint}
        accessibilityState={pressed === undefined ? { disabled } : { disabled, selected: pressed }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed: down }) => [
          styles.button,
          kind === 'primary' ? styles.primary : styles.second,
          grow && styles.grow,
          compact && styles.compact,
          down && pressedStyles.pressed,
        ]}
      >
        <Animated.Text
          key={label}
          {...(animateLabel
            ? { entering: FadeIn.duration(LABEL_FADE_MS).easing(easeOut).reduceMotion(ReduceMotion.Never) }
            : {})}
          {...(compact ? { maxFontSizeMultiplier: COMPACT_MAX_SCALE } : {})}
          style={kind === 'primary' ? styles.primaryText : styles.secondText}
        >
          {label}
        </Animated.Text>
      </Pressable>
    </Animated.View>
  )
}
