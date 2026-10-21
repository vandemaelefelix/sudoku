import { HAPTICS_KEY } from '@/settings/constants/haptics.constants'
import { createMemorySettings } from '@/settings/memorySettings'
import { createSettingStore } from '@/settings/settingStore'
import { HAPTICS_SETTING, parseHapticsOn } from './haptics.utils'

describe('parseHapticsOn', () => {
  it.each([
    [null, true],
    ['on', true],
    ['off', false],
    ['broken', true],
  ])('reads %p as %p', (value, on) => {
    expect(parseHapticsOn(value)).toBe(on)
  })
})

describe('HAPTICS_SETTING', () => {
  it.each([
    [true, 'on'],
    [false, 'off'],
  ])('saves %p as %p under the same key', async (on, text) => {
    const settings = createMemorySettings({ [HAPTICS_KEY]: on ? 'off' : 'on' })
    await createSettingStore(settings, HAPTICS_SETTING).set(on)
    expect(await settings.get(HAPTICS_KEY)).toBe(text)
  })
})
