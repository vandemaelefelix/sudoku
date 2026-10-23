import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  row: {
    minHeight: theme.size.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
  },
  // Rows are divided by the weight of the box lines of the grid, in the strong line colour (ADR-026).
  divider: { borderTopWidth: theme.components.summary.ruleWidth, borderTopColor: theme.components.summary.rule },
  text: { flex: 1, minWidth: 0 },
  label: { ...roleSized(theme.type.button), color: theme.colors.text },
  description: {
    ...roleSized(theme.type.caption),
    marginTop: theme.space.xs / 2,
    color: theme.colors.textMuted,
  },
}))
