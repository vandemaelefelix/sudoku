import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  section: {
    marginTop: theme.space.xl,
    paddingTop: theme.space.md,
    borderTopWidth: theme.components.summary.ruleWidth,
    borderTopColor: theme.components.summary.rule,
  },
  title: { ...roleFont(theme.type.title), fontSize: theme.type.title.scale, color: theme.colors.text },
  note: { ...roleFont(theme.type.caption), fontSize: theme.type.caption.scale, color: theme.colors.textMuted },
}))
