import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  canvas: { position: 'absolute' },
  digit: { position: 'absolute', textAlign: 'center', fontWeight: '700' },
  tabs: {
    flexDirection: 'row',
    gap: theme.space.xs,
    padding: theme.space.xs,
    borderRadius: theme.shape.radius.md,
    backgroundColor: theme.colors.background,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: theme.shape.radius.sm },
  tabOn: { backgroundColor: theme.colors.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  tabTextOn: { fontSize: 13, fontWeight: '600', color: theme.colors.onAccent },
  note: { position: 'absolute', fontSize: 12, color: theme.colors.textMuted },
  badge: {
    position: 'absolute',
    margin: theme.space.xs,
    paddingHorizontal: theme.space.xs,
    paddingVertical: 2,
    borderRadius: theme.shape.radius.sm,
    overflow: 'hidden',
    fontSize: 12,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
}))
