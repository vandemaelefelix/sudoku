import { Pressable, View } from 'react-native'
import { Icon } from '@/components/Icon'
import { MistakeDots } from '@/game/components/MistakeDots'
import { TimerPill } from '@/game/components/TimerPill'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './Header.styles'
import { useIntl } from '@/i18n/hooks/useIntl'

type HeaderProps = { onBack(): void }

export function Header({ onBack }: HeaderProps) {
  const intl = useIntl()
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={intl.formatMessage({ id: 'common.backHome' })}
          onPress={onBack}
          style={({ pressed }) => [styles.back, pressed && pressedStyles.pressed]}
        >
          <Icon name="back" tone="text" />
        </Pressable>
      </View>
      <TimerPill />
      <View style={[styles.side, styles.end]}>
        <MistakeDots />
      </View>
    </View>
  )
}
