import { StyleSheet } from 'react-native-unistyles'
import { FIXED_COLORS } from '@/theme/fixed.colors'

export const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center', paddingTop: 70 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: FIXED_COLORS.labPill },
  pillText: { color: FIXED_COLORS.labText, fontSize: 15, fontWeight: '600' },
  list: { marginTop: 8, padding: 12, minWidth: 240, borderRadius: 14, backgroundColor: FIXED_COLORS.labList },
  family: { marginTop: 8, color: FIXED_COLORS.labFamily, fontSize: 12, textTransform: 'uppercase' },
  row: { paddingVertical: 8 },
  rowText: { color: FIXED_COLORS.labText, fontSize: 16 },
  rowActive: { color: FIXED_COLORS.labActive, fontSize: 16, fontWeight: '600' },
})
