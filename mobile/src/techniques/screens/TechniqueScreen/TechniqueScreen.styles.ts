import { StyleSheet } from 'react-native-unistyles'
import { contentInset } from '@/theme/content'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    gap: theme.space.lg,
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom + theme.space.lg,
    paddingHorizontal: contentInset(theme, rt.screen.width),
  },
  definition: { ...roleFont(theme.type.button), fontSize: theme.type.button.scale, color: theme.colors.text },
  level: { ...roleFont(theme.type.caption), fontSize: theme.type.caption.scale, color: theme.colors.textMuted },
  body: { ...roleFont(theme.type.body), fontSize: theme.type.body.scale, color: theme.colors.text },
  section: {
    ...roleFont(theme.type.section),
    fontSize: theme.type.section.scale,
    letterSpacing: theme.type.section.scale * theme.type.section.tracking,
    textTransform: 'uppercase',
    color: theme.colors.text,
  },
  caption: { ...roleFont(theme.type.caption), fontSize: theme.type.caption.scale, color: theme.colors.textMuted },
}))
