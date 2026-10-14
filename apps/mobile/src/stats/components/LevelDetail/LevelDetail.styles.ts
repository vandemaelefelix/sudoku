import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: theme.space.lg,
  },
  chartTitle: { ...roleFont(theme.type.body), fontSize: theme.type.body.scale, color: theme.colors.text },
  chartNote: { ...roleFont(theme.type.caption), fontSize: theme.type.caption.scale, color: theme.colors.textMuted },
  empty: {
    marginTop: theme.space.xl,
    overflow: 'hidden',
    borderWidth: theme.components.summary.borderWidth,
    borderColor: theme.components.summary.border,
    borderRadius: theme.components.summary.radius,
  },
  emptyBody: { gap: theme.space.sm, padding: theme.space.lg },
  emptyTitle: { ...roleFont(theme.type.question), fontSize: theme.type.question.scale, color: theme.colors.text },
  emptyText: { ...roleFont(theme.type.body), fontSize: theme.type.body.scale, color: theme.colors.textMuted },
}))
