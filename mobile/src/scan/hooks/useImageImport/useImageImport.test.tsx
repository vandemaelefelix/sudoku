import { act, renderHook } from '@testing-library/react-native'
import { launchImageLibraryAsync, type ImagePickerResult } from 'expo-image-picker'
import { useImageImport } from './useImageImport'

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Current: 'current' },
}))

const launch = jest.mocked(launchImageLibraryAsync)
const PICKED: ImagePickerResult = {
  canceled: false,
  assets: [{ uri: 'file:///cache/ImagePicker/picked.png', width: 1206, height: 2622 }],
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => jest.restoreAllMocks())

it('gives the uri of the picked image', async () => {
  launch.mockResolvedValue(PICKED)
  const { result } = renderHook(() => useImageImport())
  let pick
  await act(async () => {
    pick = await result.current.choose()
  })
  expect(pick).toEqual({ kind: 'picked', uri: 'file:///cache/ImagePicker/picked.png' })
})

it('asks for one image in its original file, without EXIF', async () => {
  launch.mockResolvedValue(PICKED)
  const { result } = renderHook(() => useImageImport())
  await act(async () => void (await result.current.choose()))
  expect(launch).toHaveBeenCalledWith(
    expect.objectContaining({
      mediaTypes: ['images'],
      allowsEditing: false,
      allowsMultipleSelection: false,
      quality: 1,
      exif: false,
      preferredAssetRepresentationMode: 'current',
    }),
  )
})

it('gives cancelled when the player closes the picker', async () => {
  launch.mockResolvedValue({ canceled: true, assets: null })
  const { result } = renderHook(() => useImageImport())
  let pick
  await act(async () => {
    pick = await result.current.choose()
  })
  expect(pick).toEqual({ kind: 'cancelled' })
})

it('gives the reason when the picker fails', async () => {
  launch.mockRejectedValue(new Error('the image is in iCloud'))
  const { result } = renderHook(() => useImageImport())
  let pick
  await act(async () => {
    pick = await result.current.choose()
  })
  expect(pick).toEqual({ kind: 'failed', reason: 'the image is in iCloud' })
})

it('is picking while the picker is open, and opens one picker at a time', async () => {
  const open = deferred<ImagePickerResult>()
  launch.mockReturnValue(open.promise)
  const { result } = renderHook(() => useImageImport())
  let first: Promise<unknown> = Promise.resolve()
  await act(async () => {
    first = result.current.choose()
  })
  expect(result.current.picking).toBe(true)
  let second
  await act(async () => {
    second = await result.current.choose()
  })
  expect(second).toEqual({ kind: 'cancelled' })
  expect(launch).toHaveBeenCalledTimes(1)
  await act(async () => {
    open.resolve(PICKED)
    await first
  })
  expect(result.current.picking).toBe(false)
})
