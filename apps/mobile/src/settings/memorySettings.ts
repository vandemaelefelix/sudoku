import type { SettingsRepository } from './SettingsRepository'

/** The in-memory fake of SettingsRepository for Jest (ADR-012). */
export function createMemorySettings(initial: Record<string, string> = {}): SettingsRepository {
  const items = new Map(Object.entries(initial))
  return {
    get: async (key) => items.get(key) ?? null,
    set: async (key, value) => {
      items.set(key, value)
    },
  }
}
