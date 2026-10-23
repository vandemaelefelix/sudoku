import { StyleSheet } from 'react-native-unistyles'
import { roleSized } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  linkRow: {
    minHeight: theme.size.touch,
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
  },
  link: {
    ...roleSized(theme.type.caption),
    color: theme.colors.textMuted,
    textDecorationLine: 'underline',
  },
}))
