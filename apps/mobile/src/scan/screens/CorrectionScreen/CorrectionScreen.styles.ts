import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  title: { position: 'absolute', alignItems: 'center', justifyContent: 'center', gap: 2 },
  titleText: { fontSize: 17, fontWeight: '600' },
  subtitle: { fontSize: 13 },
  waiting: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  panel: {
    position: 'absolute',
    borderRadius: 24,
    padding: 12,
    gap: 9,
    justifyContent: 'center',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  chip: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999 },
  chipText: { fontSize: 13, fontWeight: '600' },
  sure: { fontSize: 13, fontWeight: '500' },
  play: { alignItems: 'center', paddingVertical: 12, borderRadius: 14, opacity: 0.5 },
  playText: { fontSize: 16, fontWeight: '600' },
  retake: { fontSize: 15, fontWeight: '500', textAlign: 'center' },
  failure: { gap: 4 },
  failureTitle: { fontSize: 16, fontWeight: '600' },
  failureReason: { fontSize: 13 },
})
