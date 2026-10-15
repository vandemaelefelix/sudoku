import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

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
    ...roleFont(theme.type.button),
    fontSize: theme.type.button.scale,
    color: theme.components.button.onPrimary,
  },
  outlineText: { ...roleFont(theme.type.button), fontSize: theme.type.button.scale, color: theme.colors.text },
}))
