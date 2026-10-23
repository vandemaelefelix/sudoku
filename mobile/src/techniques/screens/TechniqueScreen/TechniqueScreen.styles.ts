import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
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
