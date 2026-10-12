import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 6,
    borderColor: theme.colors.warning,
  },
}))
