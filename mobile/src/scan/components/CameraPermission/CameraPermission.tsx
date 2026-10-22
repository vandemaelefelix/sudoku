import { StatusBar } from 'expo-status-bar'
import { Button, Linking, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { useIntl } from '@/i18n/hooks/useIntl'
import { styles } from './CameraPermission.styles'

function ChooseButton({ onChooseImage, color }: { onChooseImage: (() => void) | undefined; color: string }) {
  const intl = useIntl()
  if (onChooseImage === undefined) return null
  return (
    <Button
      testID="choose-image"
      title={intl.formatMessage({ id: 'scan.camera.library' })}
      color={color}
      onPress={onChooseImage}
    />
  )
}

/** waiting: the permission prompt is open. denied: the user said no. missing: the phone has no back camera. */
export type CameraBlock = 'waiting' | 'denied' | 'missing'

/**
 * The screen in place of the camera, when the app cannot use it. onChooseImage: a scan of an image from the photo library still
 * works without the camera, so the denied and missing screens offer it.
 */
export function CameraPermission({ block, onChooseImage }: { block: CameraBlock; onChooseImage?: () => void }) {
  const { theme } = useUnistyles()
  const intl = useIntl()
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
        <Text style={styles.text}>{intl.formatMessage({ id: 'scan.camera.denied' })}</Text>
        <Button
          testID="open-settings"
          title={intl.formatMessage({ id: 'scan.camera.openSettings' })}
          color={theme.colors.accent}
          onPress={() => void Linking.openSettings()}
        />
        <ChooseButton onChooseImage={onChooseImage} color={theme.colors.accent} />
      </View>
    )
  }
  return (
    <View testID="camera-missing" style={styles.message}>
      <StatusBar style={theme.statusBar} />
      <Text style={styles.text}>{intl.formatMessage({ id: 'scan.camera.missing' })}</Text>
      <ChooseButton onChooseImage={onChooseImage} color={theme.colors.accent} />
    </View>
  )
}
