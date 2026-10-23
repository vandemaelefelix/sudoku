import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  section: {
    // The designs leave 40 points above a rule, so the sections do not crowd each other.
    marginTop: theme.space.xxl + theme.space.sm,
    paddingTop: theme.space.lg,
    borderTopWidth: theme.shape.stroke.thin,
    borderTopColor: theme.colors.line,
  },
  title: { ...roleSized(theme.type.title), color: theme.colors.text },
  note: { ...roleSized(theme.type.caption), color: theme.colors.textMuted },
}))
