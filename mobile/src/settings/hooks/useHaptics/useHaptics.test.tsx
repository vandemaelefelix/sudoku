import { act, renderHook } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import Storage from 'expo-sqlite/kv-store'
import { HAPTICS_KEY } from '@/settings/constants/haptics.constants'
import { useHaptics } from './useHaptics'


// The store is one module value for the whole test file, so each test turns haptics on again.
afterEach(async () => {
  const { result, unmount } = renderHook(() => useHaptics())
  await act(async () => result.current.setOn(true))
  unmount()
})

it('starts with haptics on when nothing is saved', () => {
  const { result } = renderHook(() => useHaptics())
  expect(result.current.on).toBe(true)
})

it('plays a haptic while the switch is on', () => {
  const { result } = renderHook(() => useHaptics())
  result.current.play('tick')
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1)
})

it('plays nothing after the player turns haptics off', async () => {
  const settings = renderHook(() => useHaptics())
  const game = renderHook(() => useHaptics())
  await act(async () => settings.result.current.setOn(false))
  expect(game.result.current.on).toBe(false)
  game.result.current.play('success')
  expect(Haptics.notificationAsync).not.toHaveBeenCalled()
  expect(Storage.setItemAsync).toHaveBeenLastCalledWith(HAPTICS_KEY, 'off')
})

it('keeps the identity of play, so an effect that calls it does not run again', async () => {
  const { result } = renderHook(() => useHaptics())
  const first = result.current.play
  await act(async () => result.current.setOn(false))
  expect(result.current.play).toBe(first)
})
