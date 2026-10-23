import { StyleSheet } from 'react-native-unistyles'
import { roleFont, roleSized } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
  rate: { flexDirection: 'row', alignItems: 'baseline', gap: theme.space.sm },
  value: { ...roleFont(theme.type.title), fontSize: theme.type.title.scale * 1.6, color: theme.colors.text },
  text: { ...roleSized(theme.type.body), color: theme.colors.text },
  strong: { ...roleFont(theme.type.label), fontSize: theme.type.body.scale, color: theme.colors.text },
  streak: { flexDirection: 'row', alignItems: 'center', gap: theme.space.md },
}))
