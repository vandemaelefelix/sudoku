import { StyleSheet } from 'react-native-unistyles'
import { roleText } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  button: {
    height: 54,
    paddingHorizontal: theme.space.xl - theme.space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.components.button.radius,
  },
  grow: { flex: 1 },
  // Grows with Dynamic Type, never below a touch target.
  compact: { height: 'auto', minHeight: theme.size.touch, paddingHorizontal: theme.space.sm },
  primary: { backgroundColor: theme.components.button.primary },
  second: {
    backgroundColor: theme.components.button.second,
    borderWidth: theme.components.button.outlineWidth,
    borderColor: theme.components.button.outline,
  },
  primaryText: { ...roleText(theme.type.button), color: theme.components.button.onPrimary },
  secondText: { ...roleText(theme.type.button), color: theme.colors.text },
}))
