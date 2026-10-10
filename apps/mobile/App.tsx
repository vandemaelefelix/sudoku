import { probeOpenCV } from './src/scanner'
import { CameraScreen } from './src/scan/CameraScreen'

if (__DEV__) console.log(`[scanner] fast-opencv ${probeOpenCV() ? 'works' : 'FAILED'}`)

export default function App() {
  return <CameraScreen />
}
