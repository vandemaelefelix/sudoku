import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  ring: {
    position: 'absolute',
    borderWidth: theme.shape.stroke.dot,
    borderStyle: 'dashed',
    // A pill radius makes a circle of the square ring.
    borderRadius: theme.components.checkRing.round ? theme.shape.radius.pill : 6,
    borderColor: theme.components.checkRing.color,
  },
  active: { borderWidth: theme.shape.stroke.ring, borderStyle: 'solid' },
}))
