import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  row: {
    minHeight: theme.size.touch,
    justifyContent: 'center',
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
  },
  action: { ...roleSized(theme.type.button), color: theme.colors.text },
  destructiveAction: { ...roleSized(theme.type.button), color: theme.colors.danger },
  email: { ...roleSized(theme.type.body), color: theme.colors.textMuted },
}))
