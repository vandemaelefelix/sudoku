import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.space.sm,
    paddingTop: theme.space.xl,
    borderBottomWidth: theme.components.summary.ruleWidth,
    borderBottomColor: theme.components.summary.rule,
  },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: {
    alignSelf: 'stretch',
    borderWidth: theme.shape.stroke.dot,
    borderBottomWidth: 0,
    borderColor: theme.colors.accent,
  },
  fastest: { backgroundColor: theme.colors.accent },
  label: {
    ...roleSized(theme.type.eyebrow),
    color: theme.colors.accent,
    marginBottom: theme.space.xs,
    // Wide enough for "100:00" and wider than a slot, so the time never wraps. The slot centres it and the chart does not clip it.
    width: 64,
    textAlign: 'center',
  },
}))
