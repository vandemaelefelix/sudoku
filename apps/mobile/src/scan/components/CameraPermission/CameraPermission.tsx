import { StatusBar } from 'expo-status-bar'
import { Button, Linking, Text, View } from 'react-native'
import { styles } from './CameraPermission.styles'

/** waiting: the permission prompt is open. denied: the user said no. missing: the phone has no back camera. */
export type CameraBlock = 'waiting' | 'denied' | 'missing'

/** The screen in place of the camera, when the app cannot use it. */
export function CameraPermission({ block }: { block: CameraBlock }) {
  if (block === 'waiting') {
    return (
      <View testID="camera-waiting" style={styles.message}>
        <StatusBar style="dark" />
      </View>
    )
  }
  if (block === 'denied') {
    return (
      <View testID="camera-denied" style={styles.message}>
        <StatusBar style="dark" />
        <Text style={styles.text}>Sudoku needs the camera to scan a puzzle.</Text>
        <Button testID="open-settings" title="Open Settings" onPress={() => void Linking.openSettings()} />
      </View>
    )
  }
  return (
    <View testID="camera-missing" style={styles.message}>
      <StatusBar style="dark" />
      <Text style={styles.text}>This phone has no back camera.</Text>
    </View>
  )
}
