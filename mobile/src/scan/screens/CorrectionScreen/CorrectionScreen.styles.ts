import { StyleSheet } from 'react-native-unistyles'
import { roleText } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  screen: { ...StyleSheet.absoluteFillObject },
  screenFilled: { backgroundColor: theme.colors.background },
  bar: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  retake: {
    height: theme.size.touch,
    marginLeft: -6,
    paddingRight: theme.space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  retakeText: { ...roleText(theme.type.body), color: theme.colors.text },
  barTitle: { ...roleText(theme.type.display), color: theme.colors.text },
  barEnd: { minWidth: 80, alignItems: 'flex-end' },
  wrench: {
    width: theme.size.touch,
    height: theme.size.touch,
    marginRight: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: { position: 'absolute', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  display: { ...roleText(theme.type.display), color: theme.colors.accent, flex: 1, marginRight: theme.space.md },
  waiting: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  panel: {
    position: 'absolute',
    bottom: 0,
    borderTopLeftRadius: theme.components.panel.radius,
    borderTopRightRadius: theme.components.panel.radius,
    borderTopWidth: theme.components.panel.borderWidth,
    borderTopColor: theme.components.panel.border,
    backgroundColor: theme.components.panel.fill,
    boxShadow: theme.elevation.panel,
  },
  panelBody: { gap: theme.space.lg },
  failure: { gap: theme.space.sm },
  failureTitle: { ...roleText(theme.type.status), color: theme.colors.text },
  failureReason: { ...roleText(theme.type.caption), color: theme.colors.textMuted },
}))
