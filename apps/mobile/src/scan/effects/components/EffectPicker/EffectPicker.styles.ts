import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center', paddingTop: 70 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.6)' },
  pillText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  list: { marginTop: 8, padding: 12, minWidth: 240, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.8)' },
  family: { marginTop: 8, color: 'rgba(255,255,255,0.6)', fontSize: 12, textTransform: 'uppercase' },
  row: { paddingVertical: 8 },
  rowText: { color: '#ffffff', fontSize: 16 },
  rowActive: { color: '#ffd60a', fontSize: 16, fontWeight: '600' },
})
