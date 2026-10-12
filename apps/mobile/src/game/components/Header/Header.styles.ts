import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(() => ({
  header: { height: 48, flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1, flexDirection: 'row' },
  end: { justifyContent: 'flex-end' },
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
}))
