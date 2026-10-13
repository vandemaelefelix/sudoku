import { StyleSheet } from 'react-native-unistyles'
import { roleText } from '@/theme/typography'

const KNOB = 22
const TRACK = 4

export const styles = StyleSheet.create((theme) => ({
  slider: { gap: theme.space.xs },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { ...roleText(theme.type.body), fontWeight: '600', color: theme.colors.text },
  value: { ...roleText(theme.type.eyebrow), color: theme.colors.textMuted },
  area: { height: theme.size.touch, justifyContent: 'center' },
  track: { height: TRACK, borderRadius: TRACK / 2, backgroundColor: theme.colors.line },
  fill: { position: 'absolute', left: 0, height: TRACK, borderRadius: TRACK / 2, backgroundColor: theme.colors.text },
  knob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    marginLeft: -KNOB / 2,
    borderRadius: KNOB / 2,
    backgroundColor: theme.components.switch.knob,
    borderWidth: theme.shape.stroke.thin,
    borderColor: theme.colors.lineStrong,
  },
}))
