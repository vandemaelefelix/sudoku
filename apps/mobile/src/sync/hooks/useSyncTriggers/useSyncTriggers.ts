import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import type { SyncService } from '@/sync/SyncService'

/**
 * The triggers that need no account (ADR-028, decision 7): a game ends, the app comes to the foreground and the network
 * comes back. The service ignores them while there is no session. The sign-in trigger lives in SyncProvider.
 */
export function useSyncTriggers(service: SyncService | null): void {
  const storage = useGameStorage()
  useEffect(() => {
    if (service === null) return undefined
    return storage.subscribe(() => void service.trigger('game-end'))
  }, [service, storage])
  useEffect(() => {
    if (service === null) return undefined
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void service.trigger('foreground')
    })
    return () => subscription.remove()
  }, [service])
  useEffect(() => {
    if (service === null) return undefined
    // The start state comes from one read on mount, because the listener sends no event until the state changes.
    // Only a change from not connected to connected triggers.
    let wasConnected: boolean | null = null
    const subscription = addNetworkStateListener((state) => {
      const connected = state.isConnected === true
      if (wasConnected === false && connected) void service.trigger('network')
      wasConnected = connected
    })
    void getNetworkStateAsync().then(
      (state) => {
        wasConnected ??= state.isConnected === true
      },
      () => undefined,
    )
    return () => subscription.remove()
  }, [service])
}
