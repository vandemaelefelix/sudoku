import { StyleSheet } from 'react-native-unistyles'

/** The look of a button while the finger is on it. It changes at once, so a tap feels answered. */
export const pressedStyles = StyleSheet.create((theme) => ({
  pressed: { opacity: theme.opacity.pressed },
}))
