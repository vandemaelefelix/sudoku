import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

// The field uses the frame of the stats card, so it reads as part of the Op-art page (ADR-026).
export const styles = StyleSheet.create((theme) => ({
  field: { gap: theme.space.xs },
  label: { ...roleSized(theme.type.label), color: theme.colors.text },
  input: {
    ...roleSized(theme.type.body),
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
  error: { ...roleSized(theme.type.caption), color: theme.colors.danger },
}))
