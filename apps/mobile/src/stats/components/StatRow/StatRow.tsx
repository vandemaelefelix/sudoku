import { Text, View } from 'react-native'
import { styles } from './StatRow.styles'

type StatRowProps = { label: string; note?: string; value: string }

export function StatRow({ label, note, value }: StatRowProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}${note === undefined ? '' : `, ${note}`}: ${value}`}
      style={styles.row}
    >
      <Text style={styles.label}>
        {label}
        {note !== undefined && <Text style={styles.note}> {note}</Text>}
      </Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
}
