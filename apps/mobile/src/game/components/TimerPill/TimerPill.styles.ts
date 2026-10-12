import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  area: { minHeight: theme.size.touch, justifyContent: 'center' },
  pill: {
    height: theme.size.pill.height,
    paddingHorizontal: theme.size.pill.paddingHorizontal,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    borderWidth: theme.shape.stroke.thin,
    borderColor: theme.colors.line,
    borderRadius: theme.shape.radius.pill,
  },
  // The canvas shows plain muted time after the end: no border, no icon.
  endedPill: {
    height: theme.size.pill.height,
    paddingHorizontal: theme.size.pill.paddingHorizontal,
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: {
    ...roleFont(theme.type.timer),
    fontSize: theme.type.timer.scale,
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
  endedTime: {
    ...roleFont(theme.type.timer),
    fontSize: theme.type.timer.scale,
    color: theme.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
}))
