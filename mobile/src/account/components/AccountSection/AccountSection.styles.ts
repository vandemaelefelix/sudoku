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
  row: {
    minHeight: theme.size.touch,
    justifyContent: 'center',
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
  },
  divider: { borderTopWidth: theme.components.summary.ruleWidth, borderTopColor: theme.components.summary.rule },
  action: { ...roleSized(theme.type.button), color: theme.colors.text },
  destructiveAction: { ...roleSized(theme.type.button), color: theme.colors.danger },
  email: { ...roleSized(theme.type.body), color: theme.colors.textMuted },
}))
