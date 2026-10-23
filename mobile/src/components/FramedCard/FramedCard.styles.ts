import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  card: {
    overflow: 'hidden',
    borderRadius: theme.components.summary.radius,
    borderWidth: theme.components.summary.borderWidth,
    borderColor: theme.components.summary.border,
  },
  filled: { backgroundColor: theme.colors.surface },
  divider: { borderTopWidth: theme.components.summary.ruleWidth, borderTopColor: theme.components.summary.rule },
}))
