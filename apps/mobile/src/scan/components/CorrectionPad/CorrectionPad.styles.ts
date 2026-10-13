import { StyleSheet } from 'react-native-unistyles'
import { roleFont, roleText } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  pad: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  key: {
    flex: 1,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.components.panel.keyRadius,
    backgroundColor: theme.components.panel.key,
  },
  keyCurrent: { backgroundColor: theme.components.button.primary },
  keyText: { ...roleFont(theme.type.key), fontSize: theme.type.key.scale * 0.85, color: theme.colors.text },
  keyTextCurrent: { color: theme.components.button.onPrimary },
  emptyText: { ...roleText(theme.type.label), color: theme.colors.textMuted },
  hint: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderWidth: theme.shape.stroke.dot,
    borderStyle: 'dashed',
    borderColor: theme.components.checkRing.color,
    borderRadius: theme.components.checkRing.round
      ? theme.shape.radius.pill
      : Math.max(0, theme.components.panel.keyRadius - 4),
  },
}))
