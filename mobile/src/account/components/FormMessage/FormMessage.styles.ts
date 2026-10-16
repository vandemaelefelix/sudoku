import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  danger: { ...roleFont(theme.type.body), fontSize: theme.type.body.scale, color: theme.colors.danger },
  muted: { ...roleFont(theme.type.body), fontSize: theme.type.body.scale, color: theme.colors.textMuted },
}))
