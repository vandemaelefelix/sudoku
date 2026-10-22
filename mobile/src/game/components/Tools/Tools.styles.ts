import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  tools: { flexDirection: 'row', justifyContent: 'space-around' },
  tool: {
    width: theme.size.tool,
    height: theme.size.tool,
    borderRadius: theme.size.tool / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedFill: {
    position: 'absolute',
    inset: 0,
    borderRadius: theme.size.tool / 2,
    backgroundColor: theme.colors.accentSoft,
  },
}))
