import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  well: {
    alignItems: 'center',
    paddingVertical: theme.space.lg,
    borderBottomWidth: theme.shape.stroke.thin,
    borderBottomColor: theme.colors.line,
    backgroundColor: theme.colors.background,
  },
  // The canvas draws the preview 180 pt wide: cells of about 20 pt.
  frame: { width: 180, height: 180 },
}))
