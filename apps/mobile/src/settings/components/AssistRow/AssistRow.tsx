import { Switch, Text, View } from 'react-native'
import { withUnistyles } from 'react-native-unistyles'
import { styles } from './AssistRow.styles'

// No thumbColor: on iOS a thumb colour removes the shadow of the thumb.
const ThemedSwitch = withUnistyles(Switch, (theme) => ({
  trackColor: { false: theme.components.switch.off, true: theme.components.switch.on },
  ios_backgroundColor: theme.components.switch.off,
}))

type AssistRowProps = {
  label: string
  description: string
  value: boolean
  /** A line above the row. The first row of the card has none. */
  divider: boolean
  onChange(on: boolean): void
}

export function AssistRow({ label, description, value, divider, onChange }: AssistRowProps) {
  return (
    <View testID={`assist-row-${label}`} style={[styles.row, divider && styles.divider]}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <ThemedSwitch accessibilityLabel={label} value={value} onValueChange={onChange} />
    </View>
  )
}
