import { StatusBar } from 'expo-status-bar'
import { CameraScreen } from './src/scan/CameraScreen'

export default function App() {
  return (
    <>
      <CameraScreen />
      <StatusBar style="light" />
    </>
  )
}
