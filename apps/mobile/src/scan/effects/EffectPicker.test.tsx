import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { SharedValue } from 'react-native-reanimated'
import { createMemorySettings } from '../../settings/memorySettings'
import type { SettingsRepository } from '../../settings/SettingsRepository'
import { EFFECT_KEY, EffectPicker } from './EffectPicker'
import { DEFAULT_INDEX, EFFECTS, effectIndex } from './index'

// Test effects stand in for the registry, so removing a real effect cannot break these tests.
jest.mock('./index', () => {
  const effects = [
    ['alpha', 'Alpha', 'simulation'],
    ['beta', 'Beta', 'path'],
    ['gamma', 'Gamma', 'shader'],
    ['delta', 'Delta', 'screen'],
  ].map(([id, name, family]) => ({
    id,
    name,
    family,
    create: () => ({}),
    step: (state: unknown) => state,
    draw: () => {},
  }))
  return {
    EFFECTS: effects,
    DEFAULT_INDEX: 0,
    effectIndex: (id: string | null) =>
      Math.max(
        0,
        effects.findIndex((effect) => effect.id === id),
      ),
  }
})

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
    expect(screen.getByText('Alpha')).toBeTruthy()
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
    fireEvent.press(screen.getByTestId('effect-beta'))
    expect(effect.get()).toBe(effectIndex('beta'))
    expect(screen.queryByTestId('effect-list')).toBeNull()
    expect(screen.getByText('Beta')).toBeTruthy()
  })

  it('saves the choice', async () => {
    const settings = createMemorySettings()
    await renderPicker(settings)
    fireEvent.press(screen.getByTestId('effect-pill'))
    fireEvent.press(screen.getByTestId('effect-gamma'))
    await act(async () => {})
    await expect(settings.get(EFFECT_KEY)).resolves.toBe('gamma')
  })

  it('restores the saved choice on start', async () => {
    const effect = await renderPicker(createMemorySettings({ [EFFECT_KEY]: 'gamma' }))
    expect(effect.get()).toBe(effectIndex('gamma'))
    expect(screen.getByText('Gamma')).toBeTruthy()
  })

  it('runs the default effect for an unknown saved id', async () => {
    const effect = await renderPicker(createMemorySettings({ [EFFECT_KEY]: 'deleted-effect' }))
    expect(effect.get()).toBe(DEFAULT_INDEX)
    expect(screen.getByText('Alpha')).toBeTruthy()
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
    fireEvent.press(screen.getByTestId('effect-beta'))
    await act(async () => {})
    expect(effect.get()).toBe(effectIndex('beta'))
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
    fireEvent.press(screen.getByTestId('effect-beta'))
    await act(async () => {
      resolve?.('gamma')
    })
    expect(effect.get()).toBe(effectIndex('beta'))
    expect(screen.getByText('Beta')).toBeTruthy()
  })
})
