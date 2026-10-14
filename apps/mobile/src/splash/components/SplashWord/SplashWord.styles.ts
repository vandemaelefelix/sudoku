import { StyleSheet } from 'react-native-unistyles'
import { roleText } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  // The scale grows from the top left corner, which is the place of the home title.
  word: { position: 'absolute', flexDirection: 'row', transformOrigin: 'left top' },
  letter: roleText(theme.type.title),
}))
