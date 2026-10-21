import { createMemorySettings } from '@/settings/memorySettings'
import { createSettingStore, type SettingDefinition } from './settingStore'

const FLAG: SettingDefinition<boolean> = {
  key: 'test.flag',
  area: 'test',
  label: 'flag',
  parse: (value) => value !== 'off',
  serialize: (on) => (on ? 'on' : 'off'),
}

describe('createSettingStore', () => {
  it('gives the default for a missing value', () => {
    expect(createSettingStore(createMemorySettings(), FLAG).get()).toBe(true)
  })

  it('reads the saved value on the first get, and only once', () => {
    const settings = createMemorySettings({ [FLAG.key]: 'off' })
    const getSync = jest.spyOn(settings, 'getSync')
    const store = createSettingStore(settings, FLAG)
    expect(getSync).not.toHaveBeenCalled()
    expect(store.get()).toBe(false)
    store.get()
    expect(getSync).toHaveBeenCalledTimes(1)
  })

  it('gives the default and logs when the store throws', () => {
    const settings = createMemorySettings()
    settings.getSync = () => {
      throw new Error('disk')
    }
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    expect(createSettingStore(settings, FLAG).get()).toBe(true)
    expect(log).toHaveBeenCalledWith('[test] saved flag unreadable: disk')
    log.mockRestore()
  })

  it('keeps the same object until a change, so React sees a stable snapshot', () => {
    const object: SettingDefinition<{ n: number }> = {
      key: 'test.object',
      area: 'test',
      label: 'object',
      parse: () => ({ n: 1 }),
      serialize: JSON.stringify,
    }
    const store = createSettingStore(createMemorySettings(), object)
    expect(store.get()).toBe(store.get())
  })

  it('tells every listener before it saves, then saves the serialized value under the key', async () => {
    const settings = createMemorySettings()
    const store = createSettingStore(settings, FLAG)
    const first = jest.fn()
    const second = jest.fn()
    store.subscribe(first)
    store.subscribe(second)
    const save = jest.spyOn(settings, 'set')
    const saving = store.set(false)
    expect(store.get()).toBe(false)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(first.mock.invocationCallOrder[0]!).toBeLessThan(save.mock.invocationCallOrder[0]!)
    await saving
    expect(await settings.get(FLAG.key)).toBe('off')
    expect(createSettingStore(settings, FLAG).get()).toBe(false)
  })

  it('does not save or notify when the value does not change', async () => {
    const settings = createMemorySettings()
    const save = jest.spyOn(settings, 'set')
    const store = createSettingStore(settings, FLAG)
    const listener = jest.fn()
    store.subscribe(listener)
    await store.set(true)
    expect(listener).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })

  it('compares an object by its serialized text', async () => {
    const pair: SettingDefinition<{ a: boolean }> = {
      key: 'test.pair',
      area: 'test',
      label: 'pair',
      parse: (value) => (value === null ? { a: true } : { a: value === 'yes' }),
      serialize: ({ a }) => (a ? 'yes' : 'no'),
    }
    const store = createSettingStore(createMemorySettings(), pair)
    const before = store.get()
    await store.set({ a: true })
    expect(store.get()).toBe(before)
  })

  it('saves the same value again only when retrySave is true', async () => {
    const settings = createMemorySettings()
    const save = jest.spyOn(settings, 'set')
    const store = createSettingStore(settings, FLAG)
    const listener = jest.fn()
    store.subscribe(listener)
    await store.set(true)
    expect(save).not.toHaveBeenCalled()
    await store.set(true, { retrySave: true })
    expect(save).toHaveBeenCalledWith(FLAG.key, 'on')
    expect(listener).not.toHaveBeenCalled()
  })

  it('stops telling a listener after it unsubscribes', async () => {
    const store = createSettingStore(createMemorySettings(), FLAG)
    const listener = jest.fn()
    store.subscribe(listener)()
    await store.set(false)
    expect(listener).not.toHaveBeenCalled()
  })

  it('keeps the value in memory and rejects when the save fails', async () => {
    const settings = createMemorySettings()
    settings.set = async () => {
      throw new Error('disk full')
    }
    const store = createSettingStore(settings, FLAG)
    await expect(store.set(false)).rejects.toThrow('disk full')
    expect(store.get()).toBe(false)
  })

  it('logs a failed save and does not throw from trySet', async () => {
    const settings = createMemorySettings()
    settings.set = async () => {
      throw new Error('disk full')
    }
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    const store = createSettingStore(settings, FLAG)
    store.trySet(false)
    await Promise.resolve()
    await Promise.resolve()
    expect(store.get()).toBe(false)
    expect(log).toHaveBeenCalledWith('[test] flag not saved: disk full')
    log.mockRestore()
  })
})
