import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  screen: { ...StyleSheet.absoluteFillObject },
  screenFilled: { backgroundColor: theme.colors.background },
  waiting: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
}))
