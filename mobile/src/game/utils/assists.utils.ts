import { ASSISTS_KEY, DEFAULT_ASSISTS, type AssistName, type Assists } from '@/game/constants/assists.constants'
import type { SettingDefinition } from '@/preferences/settingStore'

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

export const ASSISTS_SETTING: SettingDefinition<Assists> = {
  key: ASSISTS_KEY,
  area: 'assists',
  label: 'assists',
  parse: parseAssists,
  serialize: JSON.stringify,
}
