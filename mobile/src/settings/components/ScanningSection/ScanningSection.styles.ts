import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

// The framed card of the other Settings sections (ADR-026).
export const styles = StyleSheet.create((theme) => ({
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
