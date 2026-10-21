import type { SettingsRepository } from '@/settings/SettingsRepository'
import { devLog, errorMessage } from '@/utils/log.utils'

/** What one setting declares. The store does the rest. */
export type SettingDefinition<T> = {
  /** The SettingsRepository key. A saved value keeps this key and this format, so a player keeps the setting after an update. */
  key: string
  /** The log tag. */
  area: string
  /** The name in the log lines, for example "haptics switch". */
  label: string
  /** Must give the default for null, a broken value and a missing value. Never throws. */
  parse(value: string | null): T
  /** Two values with the same text are the same value: `set` ignores a change that does not change the text. */
  serialize(value: T): string
}

export type SettingStore<T> = {
  /** Reads the saved value on the first call, then the same value until a change. useSyncExternalStore compares snapshots by identity. */
  get(): T
  subscribe(listener: () => void): () => void
  /**
   * Changes the value in memory and tells the listeners first. Then it saves. A failed save rejects.
   * Does nothing for the same value, unless `retrySave` is true: then it saves again, so a save that failed can succeed later.
   */
  set(value: T, options?: { retrySave?: boolean }): Promise<void>
  /** Like `set`, but a failed save is logged and not thrown. The value stays in memory for this session. */
  trySet(value: T): void
}

/**
 * One setting of the app (ADR-012): the value in memory, its persistence and its listeners. The read is synchronous, so the first
 * frame already has the saved value. A store that throws gives the default: the app must still start.
 */
export function createSettingStore<T>(settings: SettingsRepository, definition: SettingDefinition<T>): SettingStore<T> {
  const { key, area, label, parse, serialize } = definition
  let current: { value: T } | null = null
  const listeners = new Set<() => void>()
  const get = (): T => {
    if (current === null) {
      try {
        current = { value: parse(settings.getSync(key)) }
      } catch (error) {
        devLog(area, `saved ${label} unreadable: ${errorMessage(error)}`)
        current = { value: parse(null) }
      }
    }
    return current.value
  }
  const set = async (value: T, options?: { retrySave?: boolean }): Promise<void> => {
    const text = serialize(value)
    if (text === serialize(get())) {
      if (options?.retrySave) await settings.set(key, text)
      return
    }
    current = { value }
    for (const listener of listeners) listener()
    await settings.set(key, text)
  }
  return {
    get,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set,
    trySet(value) {
      set(value).catch((error: unknown) => devLog(area, `${label} not saved: ${errorMessage(error)}`))
    },
  }
}
