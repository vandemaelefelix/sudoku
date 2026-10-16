import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

// The heading, the hint and the framed card of the other Settings sections (ADR-026).
export const styles = StyleSheet.create((theme) => ({
  section: { gap: theme.space.sm },
  heading: { gap: theme.space.xs },
  sectionTitle: {
    ...roleFont(theme.type.section),
    fontSize: theme.type.section.scale,
    letterSpacing: theme.type.section.scale * theme.type.section.tracking,
    textTransform: 'uppercase',
    color: theme.colors.text,
  },
  hint: { ...roleFont(theme.type.caption), fontSize: theme.type.caption.scale, color: theme.colors.textMuted },
  card: {
    overflow: 'hidden',
    borderRadius: theme.components.summary.radius,
    borderWidth: theme.components.summary.borderWidth,
    borderColor: theme.components.summary.border,
    backgroundColor: theme.colors.surface,
  },
  row: {
    minHeight: theme.size.touch,
    justifyContent: 'center',
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
  },
  divider: { borderTopWidth: theme.components.summary.ruleWidth, borderTopColor: theme.components.summary.rule },
  action: { ...roleFont(theme.type.button), fontSize: theme.type.button.scale, color: theme.colors.text },
  destructiveAction: { ...roleFont(theme.type.button), fontSize: theme.type.button.scale, color: theme.colors.danger },
  email: { ...roleFont(theme.type.body), fontSize: theme.type.body.scale, color: theme.colors.textMuted },
}))
