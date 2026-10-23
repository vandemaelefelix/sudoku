import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  intro: { ...roleSized(theme.type.caption), color: theme.colors.textMuted },
}))
