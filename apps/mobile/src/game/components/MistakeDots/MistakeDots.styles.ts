import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  dots: { flexDirection: 'row', gap: 6, paddingRight: theme.space.xs },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  empty: { borderColor: theme.colors.textMuted },
  filled: { borderColor: theme.colors.danger, backgroundColor: theme.colors.danger },
}))
