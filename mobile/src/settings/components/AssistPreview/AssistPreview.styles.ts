import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  well: {
    alignItems: 'center',
    paddingVertical: theme.space.lg,
    borderBottomWidth: theme.components.summary.ruleWidth,
    borderBottomColor: theme.components.summary.rule,
    backgroundColor: theme.colors.background,
  },
  frame: { width: theme.size.preview, height: theme.size.preview },
}))
