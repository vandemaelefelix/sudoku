import { ASSISTS_KEY, DEFAULT_ASSISTS } from '@/game/constants/assists.constants'
import { createMemorySettings } from '@/settings/memorySettings'
import { createSettingStore } from '@/settings/settingStore'
import { ASSISTS_SETTING, parseAssists } from './assists.utils'

describe('parseAssists', () => {
  it('gives every assist on when nothing is saved', () => {
    expect(parseAssists(null)).toEqual(DEFAULT_ASSISTS)
  })

  it('keeps the saved switches', () => {
    const value = { rowColumn: false, box: true, selectedCell: false, sameNumbers: true }
    expect(parseAssists(JSON.stringify(value))).toEqual(value)
  })

  it('turns on an assist that the saved value does not hold', () => {
    expect(parseAssists(JSON.stringify({ box: false }))).toEqual({ ...DEFAULT_ASSISTS, box: false })
  })

  it.each(['', 'not json', '[]', 'null', '42', JSON.stringify({ box: 'no' })])(
    'falls back to the defaults for %p',
    (value) => {
      expect(parseAssists(value)).toEqual(DEFAULT_ASSISTS)
    },
  )
})

describe('ASSISTS_SETTING', () => {
  it('saves the assists as JSON under the same key', async () => {
    const settings = createMemorySettings()
    const store = createSettingStore(settings, ASSISTS_SETTING)
    await store.set({ ...DEFAULT_ASSISTS, sameNumbers: false })
    expect(await settings.get(ASSISTS_KEY)).toBe(JSON.stringify({ ...DEFAULT_ASSISTS, sameNumbers: false }))
    expect(createSettingStore(settings, ASSISTS_SETTING).get().sameNumbers).toBe(false)
  })
})
