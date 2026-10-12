import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
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
  time: {
    ...roleFont(theme.type.timer),
    fontSize: theme.type.timer.scale,
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
}))
