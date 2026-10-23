import { Pressable, Text, View } from 'react-native'
import { Icon } from '@/components/Icon'
import { useIntl } from '@/i18n/hooks/useIntl'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './ScreenHeader.styles'

type ScreenHeaderProps = {
  /** The title in the bar. A screen with its own title block gives none. */
  title?: string | undefined
  onBack(): void
}

/** The Back button and the title of a secondary screen (ADR-026). */
export function ScreenHeader({ title, onBack }: ScreenHeaderProps) {
  const intl = useIntl()
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={intl.formatMessage({ id: 'common.back' })}
        onPress={onBack}
        style={({ pressed }) => [styles.back, pressed && pressedStyles.pressed]}
      >
        <Icon name="back" tone="text" />
      </Pressable>
      {title !== undefined && (
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      )}
    </View>
  )
}
