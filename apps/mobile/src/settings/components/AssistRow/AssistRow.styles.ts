import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  row: {
    minHeight: theme.size.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
  },
  divider: { borderTopWidth: theme.shape.stroke.thin, borderTopColor: theme.colors.line },
  text: { flex: 1, minWidth: 0 },
  label: { ...roleFont(theme.type.button), fontSize: theme.type.button.scale, color: theme.colors.text },
  description: {
    ...roleFont(theme.type.caption),
    fontSize: theme.type.caption.scale,
    marginTop: theme.space.xs / 2,
    color: theme.colors.textMuted,
  },
}))
