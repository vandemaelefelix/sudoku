import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  header: { height: theme.size.header, flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1, flexDirection: 'row' },
  end: { justifyContent: 'flex-end' },
  back: {
    width: theme.size.touch,
    height: theme.size.touch,
    // The icon, not the touch area, lines up with the screen margin.
    marginLeft: -(theme.size.touch - theme.size.icon) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
}))
