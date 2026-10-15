import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

// The field uses the frame of the stats card, so it reads as part of the Op-art page (ADR-026).
export const styles = StyleSheet.create((theme) => ({
  field: { gap: theme.space.xs },
  label: { ...roleFont(theme.type.label), fontSize: theme.type.label.scale, color: theme.colors.text },
  input: {
    ...roleFont(theme.type.body),
    fontSize: theme.type.body.scale,
    minHeight: theme.size.touch,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    borderRadius: theme.components.summary.radius,
    borderWidth: theme.components.summary.borderWidth,
    borderColor: theme.components.summary.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
  },
  inputError: { borderColor: theme.colors.danger },
  error: { ...roleFont(theme.type.caption), fontSize: theme.type.caption.scale, color: theme.colors.danger },
}))
