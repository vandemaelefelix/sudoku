import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { ThemeDecoration } from '@/theme/decorations/ThemeDecoration'
import { styles } from './SectionHeading.styles'

type SectionHeadingProps = {
  title: string
  /** A line of help under the heading. */
  hint?: string | undefined
  /** What the section holds under the heading and the hint. It sits in the same group, space.sm below. */
  children?: ReactNode
}

/** The heading of a group on a secondary screen, with its wavy rule (ADR-026). */
export function SectionHeading({ title, hint, children }: SectionHeadingProps) {
  return (
    <View style={styles.section}>
      {/* The heading and its rule sit together, so the rule reads as part of the heading. */}
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <ThemeDecoration slot="sectionRule" />
      </View>
      {hint !== undefined && <Text style={styles.hint}>{hint}</Text>}
      {children}
    </View>
  )
}
