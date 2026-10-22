import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  frame: { position: 'absolute', pointerEvents: 'none', borderColor: theme.components.cell.ring },
}))
