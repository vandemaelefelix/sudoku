import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  keypad: { gap: theme.space.sm, marginTop: theme.space.md },
  locked: { opacity: 0.35 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: theme.space.sm },
}))
