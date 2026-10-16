import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  section: {
    // The designs leave 40 points above a rule, so the sections do not crowd each other.
    marginTop: theme.space.xxl + theme.space.sm,
    paddingTop: theme.space.lg,
    borderTopWidth: theme.shape.stroke.thin,
    borderTopColor: theme.colors.line,
  },
  title: { ...roleFont(theme.type.title), fontSize: theme.type.title.scale, color: theme.colors.text },
  note: { ...roleFont(theme.type.caption), fontSize: theme.type.caption.scale, color: theme.colors.textMuted },
}))
