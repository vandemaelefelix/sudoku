import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  button: {
    minHeight: theme.size.touch + theme.space.sm,
    paddingHorizontal: theme.space.xl,
    paddingVertical: theme.space.sm,
    flexDirection: 'row',
    gap: theme.space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.components.button.radius,
  },
  primary: { backgroundColor: theme.components.button.primary },
  outline: {
    backgroundColor: theme.components.button.second,
    borderWidth: theme.components.button.outlineWidth,
    borderColor: theme.components.button.outline,
  },
  // The busy and the disabled look: the button stays in place and fades.
  idle: { opacity: theme.opacity.disabled },
  primaryText: {
    ...roleSized(theme.type.button),
    color: theme.components.button.onPrimary,
  },
  outlineText: { ...roleSized(theme.type.button), color: theme.colors.text },
}))
