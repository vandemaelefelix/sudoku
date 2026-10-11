import { createMemorySettings } from './memorySettings'

describe('createMemorySettings', () => {
  it('gives null for a key that was never set', async () => {
    await expect(createMemorySettings().get('lab.effect')).resolves.toBeNull()
  })

  it('gives back the value that was set', async () => {
    const settings = createMemorySettings()
    await settings.set('lab.effect', 'ripples')
    await expect(settings.get('lab.effect')).resolves.toBe('ripples')
  })

  it('starts with the given values', async () => {
    await expect(createMemorySettings({ 'lab.effect': 'grid-lattice' }).get('lab.effect')).resolves.toBe('grid-lattice')
  })

  it('keeps each instance apart', async () => {
    const a = createMemorySettings()
    await a.set('lab.effect', 'ripples')
    await expect(createMemorySettings().get('lab.effect')).resolves.toBeNull()
  })
})
