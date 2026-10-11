import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  flash: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'white' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 48, alignItems: 'center' },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: 'white',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
})
