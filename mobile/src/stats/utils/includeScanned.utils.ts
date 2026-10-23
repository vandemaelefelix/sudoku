import type { SettingDefinition } from '@/preferences/settingStore'
import { INCLUDE_SCANNED_KEY } from '@/stats/constants/scanned.constants'

/** Scanned puzzles stay out of the stats unless the player turned them on. */
export function parseIncludeScanned(value: string | null): boolean {
  return value === 'on'
}

export const INCLUDE_SCANNED_SETTING: SettingDefinition<boolean> = {
  key: INCLUDE_SCANNED_KEY,
  area: 'stats',
  label: 'scanned switch',
  parse: parseIncludeScanned,
  serialize: (on) => (on ? 'on' : 'off'),
}
