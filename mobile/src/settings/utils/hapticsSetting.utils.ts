import { HAPTICS_KEY } from '@/settings/constants/haptics.constants'
import type { SettingDefinition } from '@/settings/settingStore'

/** Haptics are on unless the player turned them off. */
export function parseHapticsOn(value: string | null): boolean {
  return value !== 'off'
}

export const HAPTICS_SETTING: SettingDefinition<boolean> = {
  key: HAPTICS_KEY,
  area: 'haptics',
  label: 'haptics switch',
  parse: parseHapticsOn,
  serialize: (on) => (on ? 'on' : 'off'),
}
