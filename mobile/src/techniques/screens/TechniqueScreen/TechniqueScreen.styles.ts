import { StyleSheet } from 'react-native-unistyles'
import { contentInset } from '@/theme/content'
import { roleSized } from '@/theme/typography'

export const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    gap: theme.space.lg,
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom + theme.space.lg,
    paddingHorizontal: contentInset(theme, rt.screen.width),
  },
  definition: { ...roleSized(theme.type.button), color: theme.colors.text },
  level: { ...roleSized(theme.type.caption), color: theme.colors.textMuted },
  body: { ...roleSized(theme.type.body), color: theme.colors.text },
  section: {
    ...roleSized(theme.type.section),
    letterSpacing: theme.type.section.scale * theme.type.section.tracking,
    textTransform: 'uppercase',
    color: theme.colors.text,
  },
  caption: { ...roleSized(theme.type.caption), color: theme.colors.textMuted },
}))
