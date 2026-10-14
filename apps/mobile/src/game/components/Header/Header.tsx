import { Pressable, View } from 'react-native'
import { Icon } from '@/game/components/Icon'
import { MistakeDots } from '@/game/components/MistakeDots'
import { TimerPill } from '@/game/components/TimerPill'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './Header.styles'

type HeaderProps = { onBack(): void }

export function Header({ onBack }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to home"
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
