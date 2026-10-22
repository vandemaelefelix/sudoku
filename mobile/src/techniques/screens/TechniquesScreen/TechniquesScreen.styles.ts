import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

// The page of the Settings screen: the same margins, and one framed card for the list.
export const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    gap: theme.space.lg,
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom + theme.space.lg,
    paddingHorizontal: theme.space.lg,
  },
  intro: { ...roleFont(theme.type.caption), fontSize: theme.type.caption.scale, color: theme.colors.textMuted },
  card: {
    overflow: 'hidden',
    borderRadius: theme.components.summary.radius,
    borderWidth: theme.components.summary.borderWidth,
    borderColor: theme.components.summary.border,
    backgroundColor: theme.colors.surface,
  },
}))
