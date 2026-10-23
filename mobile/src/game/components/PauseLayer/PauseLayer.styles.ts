import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

// The layer is transparent: the cells under it already show empty while the game is paused.
export const styles = StyleSheet.create((theme) => ({
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.xs,
  },
  title: { ...roleSized(theme.type.title), color: theme.colors.text },
  hint: { ...roleSized(theme.type.body), color: theme.colors.textMuted },
}))
