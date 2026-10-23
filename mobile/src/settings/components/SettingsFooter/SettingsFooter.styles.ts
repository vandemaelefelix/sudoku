import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  footer: { gap: theme.space.xs, alignItems: 'center', paddingTop: theme.space.md },
  text: { ...roleSized(theme.type.caption), color: theme.colors.textMuted },
}))
