import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

// The heading and the framed card of the other Settings sections (ADR-026).
export const styles = StyleSheet.create((theme) => ({
  section: { gap: theme.space.sm },
  heading: { gap: theme.space.xs },
  sectionTitle: {
    ...roleSized(theme.type.section),
    letterSpacing: theme.type.section.scale * theme.type.section.tracking,
    textTransform: 'uppercase',
    color: theme.colors.text,
  },
  card: {
    overflow: 'hidden',
    borderRadius: theme.components.summary.radius,
    borderWidth: theme.components.summary.borderWidth,
    borderColor: theme.components.summary.border,
    backgroundColor: theme.colors.surface,
  },
  linkRow: {
    minHeight: theme.size.touch,
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
    borderTopWidth: theme.components.summary.ruleWidth,
    borderTopColor: theme.components.summary.rule,
  },
  link: {
    ...roleSized(theme.type.caption),
    color: theme.colors.textMuted,
    textDecorationLine: 'underline',
  },
}))
