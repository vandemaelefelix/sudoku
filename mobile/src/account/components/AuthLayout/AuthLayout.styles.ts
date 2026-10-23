import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  title: { ...roleSized(theme.type.title), color: theme.colors.text },
  heading: { gap: theme.space.xs },
}))
