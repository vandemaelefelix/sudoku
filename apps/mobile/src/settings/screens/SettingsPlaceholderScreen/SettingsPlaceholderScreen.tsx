import { Text, View } from 'react-native'
import { ThemeStatusBar } from '@/game/components/ThemeStatusBar'
import { styles } from './SettingsPlaceholderScreen.styles'

/** Holds the settings route until the settings screen exists. Swipe right to go back. */
export function SettingsPlaceholderScreen() {
  return (
    <View style={styles.screen}>
      <ThemeStatusBar />
      <Text accessibilityRole="header" style={styles.title}>
        Settings
      </Text>
      <Text style={styles.body}>The assists and the theme come here.</Text>
    </View>
  )
}
