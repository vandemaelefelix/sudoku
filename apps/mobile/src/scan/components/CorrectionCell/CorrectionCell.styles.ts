import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  digit: { position: 'absolute', textAlign: 'center', fontVariant: ['tabular-nums'] },
  given: { color: theme.colors.text, fontWeight: '600' },
  entry: { color: theme.colors.accent, fontWeight: '500' },
}))
