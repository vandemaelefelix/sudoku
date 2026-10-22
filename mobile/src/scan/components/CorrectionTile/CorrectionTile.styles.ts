import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  tile: { position: 'absolute', pointerEvents: 'none', backgroundColor: theme.components.cell.selectedTile },
}))
