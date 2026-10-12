import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  tools: { flexDirection: 'row', justifyContent: 'space-around' },
  // The same opacity as the locked keypad, as on the design canvas.
  locked: { opacity: 0.35 },
  tool: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  notesOn: { backgroundColor: theme.colors.accentSoft },
}))
