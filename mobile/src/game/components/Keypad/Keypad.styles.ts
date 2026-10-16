import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  keypad: { gap: theme.space.sm, marginTop: theme.space.md },
  row: { flexDirection: 'row', justifyContent: 'center', gap: theme.space.sm },
}))
