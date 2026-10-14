import { StyleSheet } from 'react-native-unistyles'
import { roleText } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  word: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  letter: roleText(theme.type.title),
}))
