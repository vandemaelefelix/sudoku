import { Pressable } from 'react-native'
import { Icon } from '@/components/Icon'
import { useIntl } from '@/i18n/hooks/useIntl'
import { FIXED_COLORS } from '@/theme/fixed.colors'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './LibraryButton.styles'

/** Opens the photo picker over the live camera. A light icon on a dark disc stays readable on any image, like the close button. */
export function LibraryButton({ onPress, disabled = false }: { onPress(): void; disabled?: boolean }) {
  const intl = useIntl()
  return (
    <Pressable
      testID="scan-library"
      accessibilityRole="button"
      accessibilityLabel={intl.formatMessage({ id: 'scan.camera.library' })}
      accessibilityHint={intl.formatMessage({ id: 'scan.camera.libraryHint' })}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && pressedStyles.pressed]}
    >
      <Icon name="photo" tone="text" color={FIXED_COLORS.closeIcon} />
    </Pressable>
  )
}
