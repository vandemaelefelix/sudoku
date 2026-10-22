import { StatusBar } from 'expo-status-bar'
import { Button, Linking, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './CameraPermission.styles'

function chooseButton(onChooseImage: (() => void) | undefined, color: string) {
  if (onChooseImage === undefined) return null
  return <Button testID="choose-image" title="Choose a photo" color={color} onPress={onChooseImage} />
}

/** waiting: the permission prompt is open. denied: the user said no. missing: the phone has no back camera. */
export type CameraBlock = 'waiting' | 'denied' | 'missing'

/**
 * The screen in place of the camera, when the app cannot use it. onChooseImage: a scan of an image from the photo library still
 * works without the camera, so the denied and missing screens offer it.
 */
export function CameraPermission({ block, onChooseImage }: { block: CameraBlock; onChooseImage?: () => void }) {
  const { theme } = useUnistyles()
  if (block === 'waiting') {
    return (
      <View testID="camera-waiting" style={styles.message}>
        <StatusBar style={theme.statusBar} />
      </View>
    )
  }
  if (block === 'denied') {
    return (
      <View testID="camera-denied" style={styles.message}>
        <StatusBar style={theme.statusBar} />
        <Text style={styles.text}>Sudoku needs the camera to scan a puzzle.</Text>
        <Button
          testID="open-settings"
          title="Open Settings"
          color={theme.colors.accent}
          onPress={() => void Linking.openSettings()}
        />
        {chooseButton(onChooseImage, theme.colors.accent)}
      </View>
    )
  }
  return (
    <View testID="camera-missing" style={styles.message}>
      <StatusBar style={theme.statusBar} />
      <Text style={styles.text}>This phone has no back camera.</Text>
      {chooseButton(onChooseImage, theme.colors.accent)}
    </View>
  )
}
