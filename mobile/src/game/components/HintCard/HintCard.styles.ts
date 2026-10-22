import { StyleSheet } from 'react-native-unistyles'
import { roleText } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  // Over the tool row and the keypad, and never taller than they are. The bottom anchor keeps the buttons in place
  // while the height follows the text.
  card: {
    position: 'absolute',
    left: theme.space.sm,
    right: theme.space.sm,
    bottom: 0,
    maxHeight: '100%',
    paddingHorizontal: theme.space.md,
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.xs,
    gap: theme.space.xs,
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
  // The text gives up its room first, and scrolls only when Dynamic Type makes it taller than the card allows.
  textBox: { flexGrow: 0, flexShrink: 1 },
  text: { ...roleText(theme.type.body), color: theme.colors.text },
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
