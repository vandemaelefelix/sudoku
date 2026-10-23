import { Text, View } from 'react-native'
import { Toggle } from '@/components/Toggle'
import { styles } from './AssistRow.styles'

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
      <View style={styles.text} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Toggle label={label} hint={description} value={value} onChange={onChange} />
    </View>
  )
}
