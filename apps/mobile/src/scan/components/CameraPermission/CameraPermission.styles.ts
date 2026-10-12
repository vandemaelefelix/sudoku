import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  message: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: theme.colors.background,
  },
  text: { fontSize: 17, textAlign: 'center', color: theme.colors.text },
}))
