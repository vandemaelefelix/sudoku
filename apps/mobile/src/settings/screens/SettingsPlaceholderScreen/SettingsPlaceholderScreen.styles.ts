import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    gap: theme.space.md,
    paddingTop: rt.insets.top + theme.space.xxl,
    paddingHorizontal: theme.space.lg,
    backgroundColor: theme.colors.background,
  },
  title: { ...roleFont(theme.type.title), fontSize: theme.type.title.scale, color: theme.colors.text },
  body: { ...roleFont(theme.type.body), fontSize: theme.type.body.scale, color: theme.colors.textMuted },
}))
