import { act, renderHook } from '@testing-library/react-native'
import Storage from 'expo-sqlite/kv-store'
import { ASSISTS_KEY, DEFAULT_ASSISTS, type AssistName } from '@/game/constants/assists.constants'
import { useAssists } from './useAssists'

// The store is one module value for the whole test file, so each test turns every assist on again.
afterEach(async () => {
  const { result, unmount } = renderHook(() => useAssists())
  const names = Object.keys(DEFAULT_ASSISTS) as AssistName[]
  await act(async () => {
    names.forEach((name) => result.current.setAssist(name, true))
  })
  unmount()
})

it('gives every assist on when nothing is saved', () => {
  const { result } = renderHook(() => useAssists())
  expect(result.current.assists).toEqual(DEFAULT_ASSISTS)
})

it('tells every reader at once', async () => {
  const settings = renderHook(() => useAssists())
  const game = renderHook(() => useAssists())
  await act(async () => settings.result.current.setAssist('box', false))
  expect(settings.result.current.assists.box).toBe(false)
  expect(game.result.current.assists.box).toBe(false)
})

it('saves the assists through the settings', async () => {
  const { result } = renderHook(() => useAssists())
  await act(async () => result.current.setAssist('sameNumbers', false))
  expect(Storage.setItemAsync).toHaveBeenLastCalledWith(
    ASSISTS_KEY,
    JSON.stringify({ ...DEFAULT_ASSISTS, sameNumbers: false }),
  )
})

it('keeps the choice for this session when the save fails', async () => {
  jest.mocked(Storage.setItemAsync).mockRejectedValueOnce(new Error('disk full'))
  const log = jest.spyOn(console, 'log').mockImplementation(() => {})
  const { result } = renderHook(() => useAssists())
  await act(async () => result.current.setAssist('rowColumn', false))
  expect(result.current.assists.rowColumn).toBe(false)
  expect(log).toHaveBeenCalledWith('[assists] assists not saved: disk full')
  log.mockRestore()
})
