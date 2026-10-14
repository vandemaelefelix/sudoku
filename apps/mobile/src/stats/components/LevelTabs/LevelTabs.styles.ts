import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  track: {
    flexDirection: 'row',
    gap: theme.space.xs,
    padding: theme.space.xs,
    borderRadius: theme.shape.radius.md,
    backgroundColor: theme.components.tabs.track,
  },
  tab: {
    flex: 1,
    minHeight: theme.size.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Math.max(0, theme.shape.radius.md - theme.space.xs),
  },
  selected: { backgroundColor: theme.components.tabs.selected, boxShadow: theme.elevation.key },
  label: { ...roleFont(theme.type.label), fontSize: theme.type.label.scale, color: theme.colors.textMuted },
  labelSelected: { color: theme.colors.text },
}))
