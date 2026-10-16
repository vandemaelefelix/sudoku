import { ASSISTS_KEY, DEFAULT_ASSISTS, type AssistName, type Assists } from '@/game/constants/assists.constants'
import type { SettingsRepository } from '@/settings/SettingsRepository'
import { devLog, errorMessage } from '@/utils/log.utils'

export type AssistsStore = {
  /** The same object until a change: useSyncExternalStore compares snapshots by identity. */
  get(): Assists
  subscribe(listener: () => void): () => void
  /** Changes the value in memory and tells the listeners first. Then it saves. A failed save rejects. */
  set(name: AssistName, on: boolean): Promise<void>
}

/** A missing or broken assist is on: an assist added in a later version starts on. */
export function parseAssists(value: string | null): Assists {
  if (value === null) return DEFAULT_ASSISTS
  let saved: unknown
  try {
    saved = JSON.parse(value)
  } catch {
    return DEFAULT_ASSISTS
  }
  if (typeof saved !== 'object' || saved === null) return DEFAULT_ASSISTS
  const record = saved as Record<string, unknown>
  const pick = (name: AssistName): boolean => {
    const on = record[name]
    return typeof on === 'boolean' ? on : DEFAULT_ASSISTS[name]
  }
  return {
    rowColumn: pick('rowColumn'),
    box: pick('box'),
    selectedCell: pick('selectedCell'),
    sameNumbers: pick('sameNumbers'),
  }
}

/** Synchronous, so the first frame of the grid already has the saved shades. A store that throws gives the defaults. */
export function readAssists(settings: SettingsRepository): Assists {
  try {
    return parseAssists(settings.getSync(ASSISTS_KEY))
  } catch (error) {
    devLog('assists', `saved assists unreadable: ${errorMessage(error)}`)
    return DEFAULT_ASSISTS
  }
}

export function createAssistsStore(settings: SettingsRepository): AssistsStore {
  let current: Assists | null = null
  const listeners = new Set<() => void>()
  const get = (): Assists => {
    current ??= readAssists(settings)
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
    async set(name, on) {
      const before = get()
      if (before[name] === on) return
      const next = { ...before, [name]: on }
      current = next
      for (const listener of listeners) listener()
      await settings.set(ASSISTS_KEY, JSON.stringify(next))
    },
  }
}
