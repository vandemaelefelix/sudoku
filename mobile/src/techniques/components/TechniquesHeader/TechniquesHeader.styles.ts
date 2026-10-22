import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  header: { minHeight: theme.size.header, flexDirection: 'row', alignItems: 'center' },
  back: {
    width: theme.size.touch,
    height: theme.size.touch,
    // The icon, not the touch area, lines up with the screen margin.
    marginLeft: -(theme.size.touch - theme.size.icon) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...roleFont(theme.type.title), fontSize: theme.type.title.scale, color: theme.colors.text, flex: 1 },
}))
