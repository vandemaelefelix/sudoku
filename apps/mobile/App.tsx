import { createEmptyGrid } from '@sudoku/core'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'

export default function App() {
  const cells = createEmptyGrid().length
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sudoku</Text>
      <Text>{`${cells} cells`}</Text>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '600' },
})
