import { StyleSheet } from 'react-native-unistyles'
import { columnInset } from '@/theme/column'

// Unistyles reads the safe-area insets natively, so the screen needs no insets hook and no render for them.
export const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom + theme.space.lg,
    paddingHorizontal: columnInset(theme, rt.screen.width),
    backgroundColor: theme.colors.background,
  },
}))
