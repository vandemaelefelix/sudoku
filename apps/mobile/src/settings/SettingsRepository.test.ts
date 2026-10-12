import Storage from 'expo-sqlite/kv-store'
import { createSettingsRepository, kvSettings } from './SettingsRepository'

function fakeStore() {
  return {
    getItemAsync: jest.fn(async (_key: string): Promise<string | null> => 'ripples'),
    getItemSync: jest.fn((_key: string): string | null => 'ripples'),
    setItemAsync: jest.fn(async (_key: string, _value: string) => undefined),
  }
}

describe('createSettingsRepository', () => {
  it('reads a key from the store', async () => {
    const store = fakeStore()
    await expect(createSettingsRepository(store).get('lab.effect')).resolves.toBe('ripples')
    expect(store.getItemAsync).toHaveBeenCalledWith('lab.effect')
  })

  it('reads a key synchronously, for the theme before the first frame', () => {
    const store = fakeStore()
    expect(createSettingsRepository(store).getSync('theme.preference')).toBe('ripples')
    expect(store.getItemSync).toHaveBeenCalledWith('theme.preference')
  })

  it('writes a key to the store', async () => {
    const store = fakeStore()
    await createSettingsRepository(store).set('lab.effect', 'grid-lattice')
    expect(store.setItemAsync).toHaveBeenCalledWith('lab.effect', 'grid-lattice')
  })
})

describe('kvSettings', () => {
  it('gives null for a key that was never set', async () => {
    await expect(kvSettings.get('never-set')).resolves.toBeNull()
  })

  it('keeps a value in the expo-sqlite key-value store', async () => {
    await kvSettings.set('lab.effect', 'grid-lattice')
    await expect(kvSettings.get('lab.effect')).resolves.toBe('grid-lattice')
    expect(jest.mocked(Storage.setItemAsync)).toHaveBeenCalledWith('lab.effect', 'grid-lattice')
  })

  it('reads a value it set, synchronously', async () => {
    await kvSettings.set('k', 'v')
    expect(kvSettings.getSync('k')).toBe('v')
  })
})
