import { StyleSheet } from 'react-native-unistyles'
import { FIXED_COLORS } from '@/theme/fixed.colors'

export const styles = StyleSheet.create({
  flash: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: FIXED_COLORS.flash },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 48, alignItems: 'center' },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: FIXED_COLORS.shutterRing,
    backgroundColor: FIXED_COLORS.shutterFill,
  },
})
