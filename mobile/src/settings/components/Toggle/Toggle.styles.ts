import { StyleSheet } from 'react-native-unistyles'

// The border width and the corner radius come from the button tokens, so the toggle is as boxy as the buttons (ADR-026).
export const styles = StyleSheet.create((theme) => {
  const border = theme.components.button.outlineWidth
  const { width, height, thumb } = theme.size.toggle
  const gap = (height - 2 * border - thumb) / 2
  return {
    // The touch area is larger than the track: 44 pt high, as every control.
    touch: { minHeight: theme.size.touch, minWidth: width, justifyContent: 'center' },
    track: {
      width,
      height,
      borderWidth: border,
      borderRadius: theme.components.button.radius,
      justifyContent: 'center',
      paddingHorizontal: gap,
    },
    trackOn: { backgroundColor: theme.components.switch.on, borderColor: theme.components.switch.on },
    trackOff: { backgroundColor: theme.components.switch.off, borderColor: theme.components.switch.border },
    thumb: { width: thumb, height: thumb, borderRadius: theme.components.button.radius },
    thumbOn: { backgroundColor: theme.components.switch.thumbOn },
    thumbOff: { backgroundColor: theme.components.switch.thumbOff },
  }
})
