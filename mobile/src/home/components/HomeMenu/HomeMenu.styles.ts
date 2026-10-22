import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'
import { contentInset } from '@/theme/content'

// Unistyles reads the safe-area insets natively, so the menu needs no insets hook.
export const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    gap: theme.space.md,
    paddingTop: rt.insets.top + theme.space.xxl,
    paddingBottom: rt.insets.bottom + theme.space.lg,
    paddingHorizontal: contentInset(theme, rt.screen.width),
    backgroundColor: theme.colors.background,
  },
  menu: { flex: 1, gap: theme.space.md },
  title: {
    ...roleFont(theme.type.title),
    fontSize: theme.type.title.scale,
    color: theme.colors.text,
    marginBottom: theme.space.lg,
  },
  noStats: { ...roleFont(theme.type.caption), fontSize: theme.type.caption.scale, color: theme.colors.textMuted },
  section: {
    ...roleFont(theme.type.label),
    fontSize: theme.type.label.scale,
    color: theme.colors.textMuted,
    marginTop: theme.space.md,
  },
  button: {
    minHeight: theme.size.touch,
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    borderRadius: theme.components.button.radius,
    borderWidth: theme.components.button.outlineWidth,
    borderColor: theme.components.button.outline,
    backgroundColor: theme.colors.surface,
  },
  continue: { backgroundColor: theme.colors.accent, borderWidth: 0 },
  label: { ...roleFont(theme.type.button), fontSize: theme.type.button.scale, color: theme.colors.text },
  continueLabel: { ...roleFont(theme.type.button), fontSize: theme.type.button.scale, color: theme.colors.onAccent },
  continueCaption: {
    ...roleFont(theme.type.caption),
    fontSize: theme.type.caption.scale,
    color: theme.colors.onAccent,
  },
  links: { flexDirection: 'row', gap: theme.space.md, marginTop: 'auto' },
  link: { flex: 1 },
}))
