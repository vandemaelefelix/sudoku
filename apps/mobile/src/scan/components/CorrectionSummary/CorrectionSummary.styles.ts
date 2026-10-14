import { StyleSheet } from 'react-native-unistyles'
import { roleText } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  summary: { gap: theme.space.lg },
  head: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },
  statusSlot: { flexShrink: 1 },
  toCheck: { minHeight: theme.size.touch, marginVertical: -8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  glyph: {
    width: 16,
    height: 16,
    borderWidth: theme.shape.stroke.dot,
    borderStyle: 'dashed',
    borderColor: theme.components.checkRing.color,
    borderRadius: theme.components.checkRing.round ? theme.shape.radius.pill : 5,
  },
  status: { ...roleText(theme.type.status), color: theme.colors.text, flexShrink: 1 },
  statusWarning: { color: theme.colors.warningText },
  statusDanger: { color: theme.colors.danger },
  level: { ...roleText(theme.type.eyebrow), color: theme.colors.textMuted },
  blocked: { ...roleText(theme.type.caption), marginTop: -theme.space.sm, color: theme.colors.danger },
  buttons: { flexDirection: 'row', gap: 10 },
}))
