import { StyleSheet } from 'react-native-unistyles'
import { roleSized, roleText } from '@/theme/typography'
import { contentInset } from '@/theme/content'

// Unistyles reads the safe-area insets natively, as on the settings screen.
export const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom + theme.space.xxl,
    paddingHorizontal: contentInset(theme, rt.screen.width),
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
  barTitle: { ...roleSized(theme.type.title), color: theme.colors.text },
  titleBlock: { height: theme.size.titleBlock, justifyContent: 'flex-end', marginBottom: theme.space.md },
  display: { ...roleText(theme.type.display), color: theme.colors.text },
  card: { marginBottom: theme.space.xl + theme.space.xs },
  message: { ...roleSized(theme.type.body), color: theme.colors.textMuted },
  stripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: theme.space.md,
    paddingBottom: theme.space.sm,
  },
  stripTitle: { ...roleSized(theme.type.body), color: theme.colors.text },
  stripNote: { ...roleSized(theme.type.caption), color: theme.colors.textMuted },
  settings: {
    marginTop: theme.space.xxl + theme.space.sm,
    borderTopWidth: theme.shape.stroke.thin,
    borderTopColor: theme.colors.line,
  },
}))
