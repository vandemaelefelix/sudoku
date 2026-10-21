import { StyleSheet } from 'react-native-unistyles'
import { FIXED_COLORS } from '@/theme/fixed.colors'

export const styles = StyleSheet.create((theme, rt) => ({
  button: {
    position: 'absolute',
    top: rt.insets.top + theme.space.sm,
    left: rt.insets.left + theme.space.sm,
    width: theme.size.touch,
    height: theme.size.touch,
    borderRadius: theme.size.touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overCamera: { backgroundColor: FIXED_COLORS.closeFill },
}))
