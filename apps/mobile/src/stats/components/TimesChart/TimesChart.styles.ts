import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

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
    ...roleFont(theme.type.eyebrow),
    fontSize: theme.type.eyebrow.scale,
    color: theme.colors.accent,
    marginBottom: theme.space.xs,
  },
}))
