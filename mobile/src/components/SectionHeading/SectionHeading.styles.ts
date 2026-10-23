import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  section: { gap: theme.space.sm },
  heading: { gap: theme.space.xs },
  title: {
    ...roleSized(theme.type.section),
    letterSpacing: theme.type.section.scale * theme.type.section.tracking,
    textTransform: 'uppercase',
    color: theme.colors.text,
  },
  hint: { ...roleSized(theme.type.caption), color: theme.colors.textMuted },
}))
