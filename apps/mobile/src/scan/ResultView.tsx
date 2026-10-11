import { StatusBar } from 'expo-status-bar'
import { Button, StyleSheet, Text, View } from 'react-native'
import type { Kind, RecogniseResult } from '../scanner'

// Issue #19 replaces this view with the correction screen.

const KIND_LABEL: { [kind in Kind]: string } = { none: '', notes: '', printed: 'P', handwritten: 'H' }

export function ResultView({ result, onRetake }: { result: RecogniseResult; onRetake: () => void }) {
  return (
    <View testID="result-view" style={styles.screen}>
      <StatusBar style="dark" />
      {result.ok ? (
        <View style={styles.grid}>
          {result.cells.map((cell, n) => (
            <View key={n} testID={`result-cell-${n}`} style={styles.cell}>
              <Text style={styles.digit}>{cell.digit === 0 ? '' : String(cell.digit)}</Text>
              <Text style={styles.kind}>{KIND_LABEL[cell.kind]}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text testID="result-failure" style={styles.message}>
          The scan failed: {result.reason}
        </Text>
      )}
      <Button testID="retake" title="Retake" onPress={onRetake} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 16, backgroundColor: 'white' },
  grid: { width: '100%', aspectRatio: 1, flexDirection: 'row', flexWrap: 'wrap', borderWidth: 2 },
  cell: {
    width: `${100 / 9}%`,
    height: `${100 / 9}%`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  digit: { fontSize: 22, fontWeight: '600' },
  kind: { position: 'absolute', right: 2, bottom: 1, fontSize: 9 },
  message: { fontSize: 17, textAlign: 'center' },
})
