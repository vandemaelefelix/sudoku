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
  // It covers the border of the pill too, so the paused pill keeps the size of the playing pill.
  pausedFill: {
    position: 'absolute',
    inset: -theme.shape.stroke.thin,
    borderRadius: theme.shape.radius.pill,
    backgroundColor: theme.colors.accent,
  },
  icon: { width: 16, height: 16 },
  iconLayer: { position: 'absolute', inset: 0 },
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
