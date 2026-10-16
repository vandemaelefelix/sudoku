import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  note: {
    ...roleFont(theme.type.caption),
    fontSize: theme.type.caption.scale,
    color: theme.colors.textMuted,
    marginTop: theme.space.xl,
  },
}))
