import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  danger: { ...roleSized(theme.type.body), color: theme.colors.danger },
  muted: { ...roleSized(theme.type.body), color: theme.colors.textMuted },
}))
