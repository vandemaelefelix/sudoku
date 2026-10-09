import { useEffect, useMemo } from 'react'
import { Button, Linking, StyleSheet, Text, View } from 'react-native'
import { Camera, useCameraDevice, useCameraPermission, useFrameOutput } from 'react-native-vision-camera'
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets'
import { countFrame, EMPTY_WINDOW } from './frameRate'

function logFrameRate(fps: number) {
  console.log(`[camera] ${fps.toFixed(1)} fps`)
}

/** The back camera, full screen. An empty frame processor logs the frame rate (issue #2). */
export function CameraScreen() {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission()
  const device = useCameraDevice('back')
  const window = useMemo(() => createSynchronizable(EMPTY_WINDOW), [])

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    onFrame(frame) {
      'worklet'
      try {
        const result = countFrame(window.getBlocking(), frame.timestamp)
        window.setBlocking(result.window)
        if (result.fps !== null) scheduleOnRN(logFrameRate, result.fps)
      } finally {
        frame.dispose()
      }
    },
  })

  useEffect(() => {
    if (canRequestPermission) void requestPermission()
  }, [canRequestPermission, requestPermission])

  if (!hasPermission) {
    if (canRequestPermission) {
      return <View testID="camera-waiting" style={styles.message} />
    }
    return (
      <View testID="camera-denied" style={styles.message}>
        <Text style={styles.text}>Sudoku needs the camera to scan a puzzle.</Text>
        <Button testID="open-settings" title="Open Settings" onPress={() => void Linking.openSettings()} />
      </View>
    )
  }
  if (device == null) {
    return (
      <View testID="camera-missing" style={styles.message}>
        <Text style={styles.text}>This phone has no back camera.</Text>
      </View>
    )
  }
  return (
    <View style={StyleSheet.absoluteFill}>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive outputs={[frameOutput]} />
    </View>
  )
}

const styles = StyleSheet.create({
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  text: { fontSize: 17, textAlign: 'center' },
})
