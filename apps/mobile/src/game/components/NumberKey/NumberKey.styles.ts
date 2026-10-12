import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  key: {
    width: theme.size.key.width,
    height: theme.size.key.height,
    borderRadius: theme.shape.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.components.key.fill,
    boxShadow: theme.elevation.key,
  },
  digit: { ...roleFont(theme.type.key), fontSize: theme.type.key.scale, color: theme.components.key.digit },
  noteDigit: {
    ...roleFont(theme.type.keyNote),
    fontSize: theme.type.keyNote.scale,
    color: theme.components.key.noteDigit,
  },
}))
