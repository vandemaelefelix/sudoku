import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: theme.space.lg,
  },
  chartTitle: { ...roleSized(theme.type.body), color: theme.colors.text },
  chartNote: { ...roleSized(theme.type.caption), color: theme.colors.textMuted },
  empty: { marginTop: theme.space.xl },
  emptyBody: { gap: theme.space.sm, padding: theme.space.lg },
  emptyTitle: { ...roleSized(theme.type.question), color: theme.colors.text },
  emptyText: { ...roleSized(theme.type.body), color: theme.colors.textMuted },
}))
