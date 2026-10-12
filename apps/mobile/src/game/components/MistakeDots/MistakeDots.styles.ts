import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  dots: { flexDirection: 'row', gap: theme.size.dot.gap, paddingRight: theme.space.xs },
  dot: {
    width: theme.size.dot.size,
    height: theme.size.dot.size,
    borderRadius: theme.size.dot.size / 2,
    borderWidth: theme.shape.stroke.dot,
  },
  empty: { borderColor: theme.colors.textMuted },
  filled: { borderColor: theme.colors.danger, backgroundColor: theme.colors.danger },
}))
