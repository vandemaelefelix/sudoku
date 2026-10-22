import { Pressable, Text, View } from 'react-native'
import { Icon } from '@/game/components/Icon'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './TechniquesHeader.styles'

/** The Back button and the title of a techniques screen, as on the Settings screen. */
export function TechniquesHeader({ title, onBack }: { title: string; onBack(): void }) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        style={({ pressed }) => [styles.back, pressed && pressedStyles.pressed]}
      >
        <Icon name="back" tone="text" />
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
    </View>
  )
}
