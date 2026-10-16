import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { styles } from './StatSection.styles'

type StatSectionProps = { title: string; note?: string; children: ReactNode }

/** A group of rows under a title and a strong rule. */
export function StatSection({ title, note, children }: StatSectionProps) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
        {note !== undefined && <Text style={styles.note}> {note}</Text>}
      </Text>
      {children}
    </View>
  )
}
