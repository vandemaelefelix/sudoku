import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  card: {
    overflow: 'hidden',
    borderRadius: theme.components.summary.radius,
    borderWidth: theme.components.summary.borderWidth,
    borderColor: theme.components.summary.border,
  },
  filled: { backgroundColor: theme.colors.surface },
  rule: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: theme.components.summary.ruleWidth,
    backgroundColor: theme.components.summary.rule,
  },
}))
