import { probeOpenCV } from './src/scanner'
import { CameraScreen } from './src/scan/CameraScreen'

/** Logs whether fast-opencv works. A failing probe must never stop the app from starting. */
export function logOpenCVProbe() {
  try {
    console.log(`[scanner] fast-opencv ${probeOpenCV() ? 'works' : 'FAILED'}`)
  } catch (error) {
    console.log(`[scanner] fast-opencv FAILED: ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (__DEV__) logOpenCVProbe()

export default function App() {
  return <CameraScreen />
}
