import { StyleSheet } from 'react-native-unistyles'
import { roleFont, roleText } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.scrim },
  sheet: {
    gap: theme.space.md,
    paddingTop: theme.space.xl,
    paddingHorizontal: theme.space.xl,
    borderTopLeftRadius: theme.components.panel.radius,
    borderTopRightRadius: theme.components.panel.radius,
    backgroundColor: theme.components.panel.fill,
    boxShadow: theme.elevation.sheet,
  },
  title: { ...roleText(theme.type.question), color: theme.colors.text },
  body: { ...roleText(theme.type.body), color: theme.colors.textMuted },
  link: {
    ...roleFont(theme.type.caption),
    fontSize: theme.type.caption.scale,
    color: theme.colors.textMuted,
    textDecorationLine: 'underline',
  },
  linkTarget: { minHeight: theme.size.touch, justifyContent: 'center', alignItems: 'center' },
}))
