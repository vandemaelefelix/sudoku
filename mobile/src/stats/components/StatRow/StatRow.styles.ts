import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: theme.space.md + theme.space.xs / 2,
    borderBottomWidth: theme.shape.stroke.thin,
    borderBottomColor: theme.colors.line,
  },
  label: { ...roleSized(theme.type.body), color: theme.colors.text },
  note: { ...roleSized(theme.type.caption), color: theme.colors.textMuted },
  value: { ...roleSized(theme.type.title), color: theme.colors.text },
}))
