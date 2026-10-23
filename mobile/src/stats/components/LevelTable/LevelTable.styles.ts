import { StyleSheet } from 'react-native-unistyles'
import { roleFont, roleSized } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  table: { marginTop: theme.space.xl },
  head: {
    flexDirection: 'row',
    borderBottomWidth: theme.components.summary.ruleWidth,
    borderBottomColor: theme.components.summary.rule,
  },
  group: { marginTop: theme.space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    borderBottomWidth: theme.shape.stroke.thin,
    borderBottomColor: theme.colors.line,
  },
  labelCell: { width: 96, paddingVertical: theme.space.md },
  cell: { flex: 1, alignItems: 'flex-end', paddingVertical: theme.space.md, paddingRight: theme.space.sm },
  headLabel: { ...roleSized(theme.type.label), color: theme.colors.textMuted },
  rowLabel: { ...roleSized(theme.type.body), color: theme.colors.text },
  value: { ...roleFont(theme.type.title), fontSize: theme.type.title.scale * 0.8, color: theme.colors.text },
  none: { color: theme.colors.textMuted },
  note: {
    ...roleSized(theme.type.caption),
    color: theme.colors.textMuted,
    marginTop: theme.space.md,
  },
}))
