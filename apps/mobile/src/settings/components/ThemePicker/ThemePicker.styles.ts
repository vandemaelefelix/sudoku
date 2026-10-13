import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  track: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.xs,
    padding: theme.space.xs,
    borderRadius: theme.shape.radius.md,
    borderWidth: theme.shape.stroke.thin,
    borderColor: theme.colors.line,
    backgroundColor: theme.components.segmented.track,
  },
  segment: {
    flexGrow: 1,
    // Less than a third, so the gaps fit: three choices share a row and a long theme name keeps its width.
    flexBasis: '29%',
    minHeight: theme.size.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Math.max(0, theme.shape.radius.md - theme.space.xs),
  },
  selected: { backgroundColor: theme.components.segmented.selected, boxShadow: theme.elevation.key },
  label: { ...roleFont(theme.type.label), fontSize: theme.type.label.scale, color: theme.colors.textMuted },
  labelSelected: { color: theme.colors.text },
}))
