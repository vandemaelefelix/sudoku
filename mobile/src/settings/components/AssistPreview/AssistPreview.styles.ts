import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  well: {
    alignItems: 'center',
    paddingVertical: theme.space.lg,
    backgroundColor: theme.colors.background,
  },
  frame: { width: theme.size.preview, height: theme.size.preview },
}))
