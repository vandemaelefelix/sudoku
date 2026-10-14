import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  row: {
    minHeight: theme.size.touch,
    justifyContent: 'center',
    gap: theme.space.xs / 2,
    paddingVertical: theme.space.md,
  },
  label: { ...roleFont(theme.type.button), fontSize: theme.type.button.scale, color: theme.colors.danger },
  description: { ...roleFont(theme.type.caption), fontSize: theme.type.caption.scale, color: theme.colors.textMuted },
}))
