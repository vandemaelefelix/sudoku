import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

// Unistyles reads the safe-area insets natively, as on the game screen.
export const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    gap: theme.space.md,
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom + theme.space.lg,
    paddingHorizontal: theme.space.lg,
  },
  header: { height: theme.size.header, flexDirection: 'row', alignItems: 'center' },
  back: {
    width: theme.size.touch,
    height: theme.size.touch,
    // The icon, not the touch area, lines up with the screen margin.
    marginLeft: -(theme.size.touch - theme.size.icon) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...roleFont(theme.type.title), fontSize: theme.type.title.scale, color: theme.colors.text },
  section: { gap: theme.space.sm, marginTop: theme.space.xs },
  sectionTitle: {
    ...roleFont(theme.type.label),
    fontSize: theme.type.label.scale,
    // The canvas spaces the uppercase heading by 0.06 em.
    letterSpacing: theme.type.label.scale * 0.06,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },
  hint: { ...roleFont(theme.type.caption), fontSize: theme.type.caption.scale, color: theme.colors.textMuted },
  card: {
    overflow: 'hidden',
    borderRadius: theme.shape.radius.lg,
    borderWidth: theme.shape.stroke.thin,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
}))
