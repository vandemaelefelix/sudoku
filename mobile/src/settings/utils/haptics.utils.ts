import type { SettingsRepository } from '@/settings/SettingsRepository'
import { HAPTICS_KEY } from '@/settings/constants/haptics.constants'
import { devLog, errorMessage } from '@/utils/log.utils'

export type HapticsStore = {
  get(): boolean
  subscribe(listener: () => void): () => void
  /** Changes the value in memory and tells the listeners first. Then it saves. A failed save rejects. */
  set(on: boolean): Promise<void>
}

/** Haptics are on unless the player turned them off. */
export function parseHapticsOn(value: string | null): boolean {
  return value !== 'off'
}

/** Synchronous, so the first haptic already follows the switch. A store that throws gives on. */
export function readHapticsOn(settings: SettingsRepository): boolean {
  try {
    return parseHapticsOn(settings.getSync(HAPTICS_KEY))
  } catch (error) {
    devLog('haptics', `saved haptics switch unreadable: ${errorMessage(error)}`)
    return true
  }
}

export function createHapticsStore(settings: SettingsRepository): HapticsStore {
  let current: boolean | null = null
  const listeners = new Set<() => void>()
  const get = (): boolean => {
    current ??= readHapticsOn(settings)
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
      await settings.set(HAPTICS_KEY, on ? 'on' : 'off')
    },
  }
}
