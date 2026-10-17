import { addNetworkStateListener } from 'expo-network'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useScanShare } from '@/scanShare/useScanShare'

/** Sends the waiting scans at app start, when the app comes back to the front and when the phone gets a connection. Renders nothing. */
export function ScanShareDrainer() {
  const { drainQueue } = useScanShare()
  useEffect(() => {
    void drainQueue()
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') void drainQueue()
    })
    const network = addNetworkStateListener((state) => {
      if (state.isConnected === true) void drainQueue()
    })
    return () => {
      app.remove()
      network.remove()
    }
  }, [drainQueue])
  return null
}
