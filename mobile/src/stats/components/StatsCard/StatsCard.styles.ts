import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  card: {
    overflow: 'hidden',
    borderWidth: theme.components.summary.borderWidth,
    borderColor: theme.components.summary.border,
    borderRadius: theme.components.summary.radius,
    backgroundColor: theme.colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
  rate: { flexDirection: 'row', alignItems: 'baseline', gap: theme.space.sm },
  value: { ...roleFont(theme.type.title), fontSize: theme.type.title.scale * 1.6, color: theme.colors.text },
  text: { ...roleFont(theme.type.body), fontSize: theme.type.body.scale, color: theme.colors.text },
  strong: { ...roleFont(theme.type.label), fontSize: theme.type.body.scale, color: theme.colors.text },
  streak: { flexDirection: 'row', alignItems: 'center', gap: theme.space.md },
}))
