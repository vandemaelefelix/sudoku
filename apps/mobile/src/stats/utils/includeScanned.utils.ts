import type { SettingsRepository } from '@/settings/SettingsRepository'
import { INCLUDE_SCANNED_KEY } from '@/stats/constants/scanned.constants'
import { devLog, errorMessage } from '@/utils/log.utils'

export type IncludeScannedStore = {
  get(): boolean
  subscribe(listener: () => void): () => void
  /** Changes the value in memory and tells the listeners first. Then it saves. A failed save rejects. */
  set(on: boolean): Promise<void>
}

/** Scanned puzzles stay out of the stats unless the player turned them on. */
export function parseIncludeScanned(value: string | null): boolean {
  return value === 'on'
}

export function createIncludeScannedStore(settings: SettingsRepository): IncludeScannedStore {
  let current: boolean | null = null
  const listeners = new Set<() => void>()
  const get = (): boolean => {
    if (current === null) {
      try {
        current = parseIncludeScanned(settings.getSync(INCLUDE_SCANNED_KEY))
      } catch (error) {
        devLog('stats', `saved scanned switch unreadable: ${errorMessage(error)}`)
        current = false
      }
    }
    return current
  }
  return {
    get,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    async set(on) {
      if (get() === on) return
      current = on
      for (const listener of listeners) listener()
      await settings.set(INCLUDE_SCANNED_KEY, on ? 'on' : 'off')
    },
  }
}
