import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  row: {
    minHeight: theme.size.touch,
    justifyContent: 'center',
    gap: theme.space.xs / 2,
    paddingVertical: theme.space.md,
  },
  label: { ...roleSized(theme.type.button), color: theme.colors.danger },
  description: { ...roleSized(theme.type.caption), color: theme.colors.textMuted },
}))
