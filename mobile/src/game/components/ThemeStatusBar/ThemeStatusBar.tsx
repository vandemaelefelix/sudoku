import { StatusBar } from 'expo-status-bar'
import { useUnistyles } from 'react-native-unistyles'

/** The status bar in the style of the theme. Its own component: a theme switch renders only this leaf. */
export function ThemeStatusBar() {
  const { theme } = useUnistyles()
  return <StatusBar style={theme.statusBar} />
}
