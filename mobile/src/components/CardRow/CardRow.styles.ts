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
  text: { flex: 1, minWidth: 0 },
  label: { ...roleSized(theme.type.button), color: theme.colors.text },
  danger: { color: theme.colors.danger },
  quiet: { ...roleSized(theme.type.body), color: theme.colors.textMuted },
  description: {
    ...roleSized(theme.type.caption),
    marginTop: theme.space.xs / 2,
    color: theme.colors.textMuted,
  },
}))
