import { StyleSheet } from 'react-native-unistyles'
import { roleText } from '@/theme/typography'

// The card sits where the keypad sits: its top margin and its two rows of keys with the gap between them.
const KEY_ROWS = 2

export const styles = StyleSheet.create((theme) => ({
  card: {
    marginTop: theme.space.xs,
    height: theme.space.md - theme.space.xs + KEY_ROWS * theme.size.key.height + theme.space.sm,
    marginHorizontal: theme.space.lg,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    gap: theme.space.xs,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.shape.stroke.thin,
    borderColor: theme.colors.line,
    borderRadius: theme.shape.radius.md,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  title: { ...roleText(theme.type.eyebrow), color: theme.colors.accent, flex: 1 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: theme.space.xs },
  step: { ...roleText(theme.type.eyebrow), color: theme.colors.textMuted },
  dot: {
    width: theme.size.dot.size,
    height: theme.size.dot.size,
    borderRadius: theme.size.dot.size / 2,
    backgroundColor: theme.colors.line,
  },
  dotOn: { backgroundColor: theme.colors.accent },
  close: { alignItems: 'center', justifyContent: 'center' },
  textBox: { flex: 1 },
  text: { ...roleText(theme.type.body), color: theme.colors.text },
  buttons: { flexDirection: 'row', gap: theme.space.sm },
}))
