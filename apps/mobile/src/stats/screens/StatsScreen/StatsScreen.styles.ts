import { StyleSheet } from 'react-native-unistyles'
import { roleFont, roleText } from '@/theme/typography'

// Unistyles reads the safe-area insets natively, as on the settings screen.
export const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom + theme.space.xxl,
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
  barTitle: { ...roleFont(theme.type.title), fontSize: theme.type.title.scale, color: theme.colors.text },
  titleBlock: { height: theme.size.titleBlock, justifyContent: 'flex-end', marginBottom: theme.space.md },
  display: { ...roleText(theme.type.display), color: theme.colors.text },
  card: { marginBottom: theme.space.xl },
  message: { ...roleFont(theme.type.body), fontSize: theme.type.body.scale, color: theme.colors.textMuted },
  settings: {
    marginTop: theme.space.xl,
    borderTopWidth: theme.components.summary.ruleWidth,
    borderTopColor: theme.components.summary.rule,
  },
}))
