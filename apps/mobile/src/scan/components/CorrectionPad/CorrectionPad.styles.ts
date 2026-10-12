import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  pad: { gap: theme.space.xs },
  row: { flexDirection: 'row', gap: theme.space.xs, height: theme.size.touch },
  kinds: {
    flex: 1,
    flexDirection: 'row',
    padding: theme.space.xs,
    borderRadius: theme.shape.radius.md,
    backgroundColor: theme.colors.background,
  },
  kind: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: theme.shape.radius.sm },
  kindOn: { backgroundColor: theme.colors.accent },
  kindText: { ...roleFont(theme.type.label), fontSize: theme.type.label.scale, color: theme.colors.textMuted },
  kindTextOn: { ...roleFont(theme.type.label), fontSize: theme.type.label.scale, color: theme.colors.onAccent },
  disabled: { opacity: theme.opacity.disabled },
  done: { justifyContent: 'center', paddingHorizontal: theme.space.lg },
  doneText: { ...roleFont(theme.type.button), fontSize: theme.type.button.scale, color: theme.colors.accent },
  key: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.shape.radius.md,
    backgroundColor: theme.colors.background,
  },
  keyText: { ...roleFont(theme.type.key), fontSize: theme.type.title.scale, color: theme.colors.text },
  clearText: { ...roleFont(theme.type.label), fontSize: theme.type.label.scale, color: theme.colors.text },
}))
