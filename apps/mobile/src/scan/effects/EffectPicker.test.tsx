import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { SharedValue } from 'react-native-reanimated'
import { createMemorySettings } from '../../settings/memorySettings'
import type { SettingsRepository } from '../../settings/SettingsRepository'
import { EFFECT_KEY, EffectPicker } from './EffectPicker'
import { DEFAULT_INDEX, EFFECTS, effectIndex } from './index'

/** A shared value stand-in that the picker writes with set(). */
function shared(value: number) {
  const holder = {
    value,
    get: () => holder.value,
    set: jest.fn((next: number) => {
      holder.value = next
    }),
  }
  return holder as unknown as SharedValue<number>
}

/** Renders the picker and lets the saved choice load. */
async function renderPicker(settings: SettingsRepository) {
  const effect = shared(DEFAULT_INDEX)
  render(<EffectPicker effect={effect} settings={settings} />)
  await act(async () => {})
  return effect
}

describe('EffectPicker', () => {
  it('shows the name of the default effect', async () => {
    await renderPicker(createMemorySettings())
    expect(screen.getByText('Gathering dots')).toBeTruthy()
    expect(screen.queryByTestId('effect-list')).toBeNull()
  })

  it('lists every effect, grouped by family', async () => {
    await renderPicker(createMemorySettings())
    fireEvent.press(screen.getByTestId('effect-pill'))
    for (const effect of EFFECTS) expect(screen.getByTestId(`effect-${effect.id}`)).toBeTruthy()
    for (const family of ['Simulation', 'Path', 'Shader', 'Screen']) expect(screen.getByText(family)).toBeTruthy()
  })

  it('switches at once and closes the list', async () => {
    const effect = await renderPicker(createMemorySettings())
    fireEvent.press(screen.getByTestId('effect-pill'))
    fireEvent.press(screen.getByTestId('effect-ripples'))
    expect(effect.get()).toBe(effectIndex('ripples'))
    expect(screen.queryByTestId('effect-list')).toBeNull()
    expect(screen.getByText('Ripples')).toBeTruthy()
  })

  it('saves the choice', async () => {
    const settings = createMemorySettings()
    await renderPicker(settings)
    fireEvent.press(screen.getByTestId('effect-pill'))
    fireEvent.press(screen.getByTestId('effect-grid-lattice'))
    await act(async () => {})
    await expect(settings.get(EFFECT_KEY)).resolves.toBe('grid-lattice')
  })

  it('restores the saved choice on start', async () => {
    const effect = await renderPicker(createMemorySettings({ [EFFECT_KEY]: 'grid-lattice' }))
    expect(effect.get()).toBe(effectIndex('grid-lattice'))
    expect(screen.getByText('Grid lattice')).toBeTruthy()
  })

  it('runs the default effect for an unknown saved id', async () => {
    const effect = await renderPicker(createMemorySettings({ [EFFECT_KEY]: 'deleted-effect' }))
    expect(effect.get()).toBe(DEFAULT_INDEX)
    expect(screen.getByText('Gathering dots')).toBeTruthy()
  })

  it('runs the default effect and logs when the store fails', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    const failing: SettingsRepository = {
      get: () => Promise.reject(new Error('disk')),
      set: () => Promise.reject(new Error('disk')),
    }
    const effect = await renderPicker(failing)
    expect(effect.get()).toBe(DEFAULT_INDEX)
    fireEvent.press(screen.getByTestId('effect-pill'))
    fireEvent.press(screen.getByTestId('effect-ripples'))
    await act(async () => {})
    expect(effect.get()).toBe(effectIndex('ripples'))
    expect(log).toHaveBeenCalledWith('[fx] settings failed: disk')
    log.mockRestore()
  })

  it('keeps a pick made before the saved choice loads', async () => {
    let resolve: ((id: string | null) => void) | null = null
    const slow: SettingsRepository = {
      get: () =>
        new Promise<string | null>((done) => {
          resolve = done
        }),
      set: async () => undefined,
    }
    const effect = shared(DEFAULT_INDEX)
    render(<EffectPicker effect={effect} settings={slow} />)
    fireEvent.press(screen.getByTestId('effect-pill'))
    fireEvent.press(screen.getByTestId('effect-ripples'))
    await act(async () => {
      resolve?.('grid-lattice')
    })
    expect(effect.get()).toBe(effectIndex('ripples'))
    expect(screen.getByText('Ripples')).toBeTruthy()
  })
})
