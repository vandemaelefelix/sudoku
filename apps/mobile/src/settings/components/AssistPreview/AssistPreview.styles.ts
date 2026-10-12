import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  well: {
    alignItems: 'center',
    paddingVertical: theme.space.lg,
    borderBottomWidth: theme.shape.stroke.thin,
    borderBottomColor: theme.colors.line,
    backgroundColor: theme.colors.background,
  },
  frame: { width: theme.size.preview, height: theme.size.preview },
}))
