import { act, renderHook } from '@testing-library/react-native'
import { createMemorySettings } from '@/preferences/memorySettings'
import { createSettingStore, type SettingDefinition } from '@/preferences/settingStore'
import { useSettingValue } from './useSettingValue'

const COUNT: SettingDefinition<number> = {
  key: 'test.count',
  area: 'test',
  label: 'count',
  parse: (value) => (value === null ? 0 : Number(value)),
  serialize: String,
}

it('reads the saved value', () => {
  const store = createSettingStore(createMemorySettings({ 'test.count': '4' }), COUNT)
  const { result } = renderHook(() => useSettingValue(store))
  expect(result.current).toBe(4)
})

it('renders again when the value changes', async () => {
  const store = createSettingStore(createMemorySettings(), COUNT)
  const { result } = renderHook(() => useSettingValue(store))
  await act(async () => store.set(7))
  expect(result.current).toBe(7)
})
