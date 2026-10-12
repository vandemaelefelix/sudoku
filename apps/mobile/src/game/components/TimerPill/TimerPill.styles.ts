import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  pill: {
    height: 36,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    borderWidth: 1,
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
