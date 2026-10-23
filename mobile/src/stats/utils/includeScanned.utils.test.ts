import { createMemorySettings } from '@/preferences/memorySettings'
import { createSettingStore } from '@/preferences/settingStore'
import { INCLUDE_SCANNED_KEY } from '@/stats/constants/scanned.constants'
import { INCLUDE_SCANNED_SETTING, parseIncludeScanned } from './includeScanned.utils'

describe('parseIncludeScanned', () => {
  it.each([
    [null, false],
    ['off', false],
    ['broken', false],
    ['on', true],
  ])('reads %p as %p', (value, on) => {
    expect(parseIncludeScanned(value)).toBe(on)
  })
})

describe('INCLUDE_SCANNED_SETTING', () => {
  it.each([
    [true, 'on'],
    [false, 'off'],
  ])('saves %p as %p under the same key', async (on, text) => {
    const settings = createMemorySettings({ [INCLUDE_SCANNED_KEY]: on ? 'off' : 'on' })
    await createSettingStore(settings, INCLUDE_SCANNED_SETTING).set(on)
    expect(await settings.get(INCLUDE_SCANNED_KEY)).toBe(text)
  })
})
