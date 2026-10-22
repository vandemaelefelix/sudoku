import { StyleSheet } from 'react-native-unistyles'
import { FIXED_COLORS } from '@/theme/fixed.colors'

export const styles = StyleSheet.create((theme) => ({
  button: {
    width: theme.size.touch,
    height: theme.size.touch,
    borderRadius: theme.size.touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FIXED_COLORS.closeFill,
  },
}))
