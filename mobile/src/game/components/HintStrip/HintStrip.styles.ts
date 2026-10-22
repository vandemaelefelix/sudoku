import { StyleSheet } from 'react-native-unistyles'
import { roleText } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    minHeight: theme.size.touch,
    marginHorizontal: theme.space.lg,
    marginBottom: theme.space.sm,
    paddingHorizontal: theme.space.md,
    backgroundColor: theme.colors.accentSoft,
    borderRadius: theme.shape.radius.md,
  },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, minHeight: theme.size.touch },
  label: { ...roleText(theme.type.label), color: theme.colors.accent },
  text: { ...roleText(theme.type.body), color: theme.colors.text, flex: 1 },
  close: { alignItems: 'center', justifyContent: 'center' },
}))
