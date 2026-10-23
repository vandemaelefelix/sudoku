import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  key: {
    width: theme.size.key.width,
    height: theme.size.key.height,
    borderRadius: theme.shape.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  raised: { backgroundColor: theme.components.key.fill, boxShadow: theme.elevation.key },
  digit: { ...roleSized(theme.type.key), color: theme.components.key.digit },
  noteLayer: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  noteDigit: {
    ...roleSized(theme.type.keyNote),
    color: theme.components.key.noteDigit,
  },
}))
