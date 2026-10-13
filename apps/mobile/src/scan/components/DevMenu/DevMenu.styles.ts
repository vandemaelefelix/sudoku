import { StyleSheet } from 'react-native-unistyles'
import { FIXED_COLORS } from '@/theme/fixed.colors'
import { roleText } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.scrim },
  dismiss: { flex: 1 },
  sheet: {
    gap: 14,
    paddingTop: theme.space.md,
    paddingHorizontal: 20,
    borderTopLeftRadius: theme.components.panel.radius,
    borderTopRightRadius: theme.components.panel.radius,
    backgroundColor: theme.components.panel.fill,
    boxShadow: theme.elevation.sheet,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  title: { ...roleText(theme.type.question), color: theme.colors.text },
  note: { ...roleText(theme.type.eyebrow), color: theme.colors.textMuted },
  close: {
    width: theme.size.touch,
    height: theme.size.touch,
    marginRight: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The photo and the flattened grid are camera images: they keep a dark frame in every theme.
  viewer: {
    height: 262,
    overflow: 'hidden',
    borderRadius: theme.components.panel.keyRadius,
    backgroundColor: FIXED_COLORS.dim,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
    borderBottomWidth: theme.shape.stroke.thin,
    borderBottomColor: theme.colors.line,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...roleText(theme.type.body), fontWeight: '600', color: theme.colors.text },
  rowSub: { ...roleText(theme.type.caption), fontSize: 12, color: theme.colors.textMuted },
  caption: { ...roleText(theme.type.caption), fontSize: 12, textAlign: 'center', color: theme.colors.textMuted },
}))
