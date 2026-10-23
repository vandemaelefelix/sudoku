import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

// The row of AssistRow, with a chevron in place of the toggle.
export const styles = StyleSheet.create((theme) => ({
  row: {
    minHeight: theme.size.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
  },
  divider: { borderTopWidth: theme.components.summary.ruleWidth, borderTopColor: theme.components.summary.rule },
  text: { flex: 1, minWidth: 0 },
  label: { ...roleSized(theme.type.button), color: theme.colors.text },
  description: {
    ...roleSized(theme.type.caption),
    marginTop: theme.space.xs / 2,
    color: theme.colors.textMuted,
  },
}))
