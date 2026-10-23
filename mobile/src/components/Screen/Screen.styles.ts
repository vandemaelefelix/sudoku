import { StyleSheet } from 'react-native-unistyles'
import { contentInset } from '@/theme/content'

// Unistyles reads the safe-area insets natively, as on the game screen.
export const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    paddingTop: rt.insets.top,
    paddingHorizontal: contentInset(theme, rt.screen.width),
  },
  stacked: { gap: theme.space.lg, paddingBottom: rt.insets.bottom + theme.space.lg },
  flow: { paddingBottom: rt.insets.bottom + theme.space.xxl },
}))
