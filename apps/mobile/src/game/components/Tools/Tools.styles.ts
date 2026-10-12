import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  tools: { flexDirection: 'row', justifyContent: 'space-around' },
  locked: { opacity: theme.opacity.locked },
  tool: {
    width: theme.size.tool,
    height: theme.size.tool,
    borderRadius: theme.size.tool / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: theme.opacity.disabled },
  notesOn: { backgroundColor: theme.colors.accentSoft },
}))
