import { Pressable, Text, View } from 'react-native'
import { Icon } from '@/components/Icon'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './LinkRow.styles'

type LinkRowProps = {
  label: string
  description: string
  onPress(): void
}

/** A row of a framed card that opens another screen. VoiceOver reads the label as the name and the description as the hint. */
export function LinkRow({ label, description, onPress }: LinkRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={description}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && pressedStyles.pressed]}
    >
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Icon name="next" tone="accent" size={16} />
    </Pressable>
  )
}
