import { HAPTICS_KEY } from '@/settings/constants/haptics.constants'
import { createMemorySettings } from '@/settings/memorySettings'
import { createHapticsStore, parseHapticsOn, readHapticsOn } from './haptics.utils'

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

describe('readHapticsOn', () => {
  it('gives on when the store throws', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    const settings = createMemorySettings()
    jest.spyOn(settings, 'getSync').mockImplementation(() => {
      throw new Error('locked')
    })
    expect(readHapticsOn(settings)).toBe(true)
    log.mockRestore()
  })
})

describe('createHapticsStore', () => {
  it('reads the saved switch on the first get, and only once', () => {
    const settings = createMemorySettings({ [HAPTICS_KEY]: 'off' })
    const getSync = jest.spyOn(settings, 'getSync')
    const store = createHapticsStore(settings)
    expect(getSync).not.toHaveBeenCalled()
    expect(store.get()).toBe(false)
    store.get()
    expect(getSync).toHaveBeenCalledTimes(1)
  })

  it('tells the listeners before it saves', async () => {
    const settings = createMemorySettings()
    const store = createHapticsStore(settings)
    const listener = jest.fn()
    store.subscribe(listener)
    const saved = store.set(false)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.get()).toBe(false)
    await saved
    expect(await settings.get(HAPTICS_KEY)).toBe('off')
  })

  it('does not save or notify when the value does not change', async () => {
    const settings = createMemorySettings()
    const set = jest.spyOn(settings, 'set')
    const store = createHapticsStore(settings)
    const listener = jest.fn()
    store.subscribe(listener)
    await store.set(true)
    expect(listener).not.toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
  })
})
