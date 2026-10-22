import { StyleSheet } from 'react-native-unistyles'
import { roleFont, roleText } from '@/theme/typography'

// The line height of the rung text, as a multiple of its size: room between the lines, so two lines read calmly.
const BODY_LEADING = 1.45

export const styles = StyleSheet.create((theme) => ({
  // It covers the tool row and the keypad from edge to edge, so it has the width of the grid and the gap above it
  // equals the gap above the grid. Its padding is the grid margin.
  card: {
    position: 'absolute',
    inset: 0,
    padding: theme.space.lg,
    gap: theme.space.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.shape.stroke.thin,
    borderColor: theme.colors.line,
    borderRadius: theme.shape.radius.md,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  titleBox: { flex: 1 },
  title: { ...roleText(theme.type.eyebrow), color: theme.colors.accent },
  progress: { flexDirection: 'row', alignItems: 'center', gap: theme.space.xs },
  step: { ...roleText(theme.type.eyebrow), color: theme.colors.textMuted },
  dot: {
    width: theme.size.dot.size,
    height: theme.size.dot.size,
    borderRadius: theme.size.dot.size / 2,
    backgroundColor: theme.colors.line,
    overflow: 'hidden',
  },
  dotFill: { position: 'absolute', inset: 0, backgroundColor: theme.colors.accent },
  close: { alignItems: 'center', justifyContent: 'center' },
  // The text takes the room between the top row and the buttons. It scrolls only when Dynamic Type makes it taller.
  textBox: { flex: 1 },
  text: { ...roleText(theme.type.body), lineHeight: theme.type.body.scale * BODY_LEADING, color: theme.colors.text },
  link: { ...roleFont(theme.type.label), color: theme.colors.accent },
  // A button that does not fit moves to a new line as a whole, so no label wraps.
  buttons: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: theme.space.sm },
  textButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.xs,
    minHeight: theme.size.touch,
    paddingHorizontal: theme.space.xs,
  },
  textButtonText: { ...roleText(theme.type.label), color: theme.colors.accent },
  main: { marginLeft: 'auto' },
}))
