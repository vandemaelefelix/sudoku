import { Pressable } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { LABEL_FADE_MS } from './PanelButton.constants'
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
}

/** A button of the correction panel, in the button tokens of the theme. */
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
}: PanelButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={pressed === undefined ? { disabled } : { disabled, selected: pressed }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        kind === 'primary' ? styles.primary : styles.second,
        grow && styles.grow,
        disabled && styles.disabled,
      ]}
    >
      <Animated.Text
        key={label}
        {...(animateLabel ? { entering: FadeIn.duration(LABEL_FADE_MS) } : {})}
        style={kind === 'primary' ? styles.primaryText : styles.secondText}
      >
        {label}
      </Animated.Text>
    </Pressable>
  )
}
