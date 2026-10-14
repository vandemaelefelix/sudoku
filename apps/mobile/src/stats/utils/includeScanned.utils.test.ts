import { createMemorySettings } from '@/settings/memorySettings'
import { INCLUDE_SCANNED_KEY } from '@/stats/constants/scanned.constants'
import { createIncludeScannedStore, parseIncludeScanned } from './includeScanned.utils'

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

describe('createIncludeScannedStore', () => {
  it('reads the saved switch once, on the first get', () => {
    const settings = createMemorySettings({ [INCLUDE_SCANNED_KEY]: 'on' })
    const getSync = jest.spyOn(settings, 'getSync')
    const store = createIncludeScannedStore(settings)
    expect(store.get()).toBe(true)
    store.get()
    expect(getSync).toHaveBeenCalledTimes(1)
  })

  it('tells the listeners, then saves', async () => {
    const settings = createMemorySettings()
    const store = createIncludeScannedStore(settings)
    const seen: boolean[] = []
    store.subscribe(() => seen.push(store.get()))
    await store.set(true)
    expect(seen).toEqual([true])
    await expect(settings.get(INCLUDE_SCANNED_KEY)).resolves.toBe('on')
  })

  it('does nothing when the value does not change', async () => {
    const settings = createMemorySettings()
    const set = jest.spyOn(settings, 'set')
    await createIncludeScannedStore(settings).set(false)
    expect(set).not.toHaveBeenCalled()
  })
})
