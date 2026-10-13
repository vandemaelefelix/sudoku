import { StyleSheet } from 'react-native-unistyles'
import { roleText } from '@/theme/typography'

const DOT = 7

export const styles = StyleSheet.create((theme) => ({
  check: { gap: theme.space.lg },
  progress: {
    height: 8,
    marginTop: -theme.space.xs,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.space.sm,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: theme.shape.stroke.dot,
    borderColor: theme.colors.line,
  },
  dotDone: { backgroundColor: theme.colors.text, borderColor: theme.colors.text },
  dotNow: {
    backgroundColor: theme.colors.warning,
    borderColor: theme.colors.warning,
    transform: [{ scale: 1.3 }],
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.space.lg },
  text: { flex: 1, minWidth: 0, gap: theme.space.xs },
  question: { ...roleText(theme.type.question), color: theme.colors.text },
  place: { ...roleText(theme.type.eyebrow), color: theme.colors.textMuted },
  close: {
    alignSelf: 'flex-start',
    width: theme.size.touch,
    height: theme.size.touch,
    marginTop: -10,
    marginRight: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kinds: {
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    borderWidth: theme.shape.stroke.thin,
    borderStyle: 'dashed',
    borderColor: theme.colors.textMuted,
    borderRadius: theme.components.panel.keyRadius,
  },
  kind: {
    flex: 1,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Math.max(0, theme.components.panel.keyRadius - 3),
  },
  kindOn: { backgroundColor: theme.components.button.primary },
  kindText: { ...roleText(theme.type.label), fontSize: 12, color: theme.colors.textMuted },
  kindTextOn: { color: theme.components.button.onPrimary },
  answers: { flexDirection: 'row', gap: 10 },
}))
