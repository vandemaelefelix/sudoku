import { StyleSheet } from 'react-native-unistyles'
import { roleText } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  failure: { gap: theme.space.sm },
  failureTitle: { ...roleText(theme.type.status), color: theme.colors.text },
  failureReason: { ...roleText(theme.type.caption), color: theme.colors.textMuted },
}))
