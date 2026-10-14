import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  badge: {
    width: theme.size.touch - 4,
    height: theme.size.touch - 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.shape.radius.sm,
    backgroundColor: theme.colors.accent,
  },
}))
