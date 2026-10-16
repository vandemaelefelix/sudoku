import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  strip: { flexDirection: 'row', gap: theme.space.xs },
  square: {
    flex: 1,
    height: 24,
    borderWidth: theme.shape.stroke.dot,
    borderColor: theme.colors.accent,
    borderRadius: theme.shape.radius.sm,
  },
  won: { backgroundColor: theme.colors.accent },
  pending: { borderStyle: 'dashed' },
}))
