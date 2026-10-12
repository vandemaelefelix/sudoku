import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  track: {
    flexDirection: 'row',
    gap: theme.space.xs,
    padding: theme.space.xs,
    borderRadius: theme.shape.radius.md,
    borderWidth: theme.shape.stroke.thin,
    borderColor: theme.colors.line,
    backgroundColor: theme.components.segmented.track,
  },
  segment: {
    flex: 1,
    minHeight: theme.size.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.shape.radius.md - theme.space.xs,
  },
  selected: { backgroundColor: theme.components.segmented.selected, boxShadow: theme.elevation.key },
  label: { ...roleFont(theme.type.label), fontSize: theme.type.label.scale, color: theme.colors.textMuted },
  labelSelected: { color: theme.colors.text },
}))
