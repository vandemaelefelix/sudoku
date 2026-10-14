import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: theme.space.md,
    borderBottomWidth: theme.shape.stroke.thin,
    borderBottomColor: theme.colors.line,
  },
  label: { ...roleFont(theme.type.body), fontSize: theme.type.body.scale, color: theme.colors.text },
  note: { ...roleFont(theme.type.caption), fontSize: theme.type.caption.scale, color: theme.colors.textMuted },
  value: { ...roleFont(theme.type.title), fontSize: theme.type.title.scale, color: theme.colors.text },
}))
