import { StyleSheet } from 'react-native-unistyles'

const SIDE = 64
const DOT = 6

export const styles = StyleSheet.create((theme) => ({
  frame: { width: SIDE, height: SIDE },
  crop: { width: SIDE, height: SIDE, overflow: 'hidden', backgroundColor: theme.colors.background },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: theme.colors.lineStrong,
  },
  topLeft: { left: -DOT / 2, top: -DOT / 2 },
  topRight: { right: -DOT / 2, top: -DOT / 2 },
  bottomLeft: { left: -DOT / 2, bottom: -DOT / 2 },
  bottomRight: { right: -DOT / 2, bottom: -DOT / 2 },
}))
