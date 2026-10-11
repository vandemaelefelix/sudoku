import Storage from 'expo-sqlite/kv-store'

/** App settings as string pairs (ADR-012). Screens use this interface, never the store. */
export type SettingsRepository = {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
}

/** The part of the expo-sqlite key-value store that settings use. */
export type KeyValueStore = {
  getItemAsync(key: string): Promise<string | null>
  setItemAsync(key: string, value: string): Promise<void>
}

export function createSettingsRepository(store: KeyValueStore): SettingsRepository {
  return {
    get: (key) => store.getItemAsync(key),
    set: (key, value) => store.setItemAsync(key, value),
  }
}

export const kvSettings: SettingsRepository = createSettingsRepository(Storage)
