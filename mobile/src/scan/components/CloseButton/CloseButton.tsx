import { Pressable } from 'react-native'
import { Icon } from '@/components/Icon'
import { useIntl } from '@/i18n/hooks/useIntl'
import { FIXED_COLORS } from '@/theme/fixed.colors'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './CloseButton.styles'

type CloseButtonProps = {
  onPress(): void
  /** True over the live camera. The button then has a light icon on a dark disc, which stays readable on any image. */
  overCamera: boolean
}

/** The way out of the scan screen, in the top-left corner inside the safe area. */
export function CloseButton({ onPress, overCamera }: CloseButtonProps) {
  const intl = useIntl()
  return (
    <Pressable
      testID="scan-close"
      accessibilityRole="button"
      accessibilityLabel={intl.formatMessage({ id: 'scan.camera.close' })}
      onPress={onPress}
      style={({ pressed }) => [styles.button, overCamera && styles.overCamera, pressed && pressedStyles.pressed]}
    >
      <Icon name="close" tone="text" color={overCamera ? FIXED_COLORS.closeIcon : undefined} />
    </Pressable>
  )
}
