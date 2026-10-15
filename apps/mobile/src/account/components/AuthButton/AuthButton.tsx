import type { ReactNode } from 'react'
import { Pressable, Text } from 'react-native'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './AuthButton.styles'

type AuthButtonProps = {
  label: string
  /** primary: the main action of the screen. outline: another way, such as Google or a link to the other screen. */
  kind: 'primary' | 'outline'
  onPress(): void
  /** A request runs. The button fades and does not act. */
  busy?: boolean
  disabled?: boolean
  /** A mark before the label, such as the Google logo. */
  icon?: ReactNode
}

export function AuthButton({ label, kind, onPress, busy = false, disabled = false, icon }: AuthButtonProps) {
  const inactive = busy || disabled
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        kind === 'primary' ? styles.primary : styles.outline,
        inactive && styles.idle,
        pressed && pressedStyles.pressed,
      ]}
    >
      {icon}
      <Text style={kind === 'primary' ? styles.primaryText : styles.outlineText}>{label}</Text>
    </Pressable>
  )
}
