import { File } from 'expo-file-system'
import { loadImage } from 'react-native-nitro-image'
import { deletePickedImage, stillPhoto } from './photoFile'

const mockDelete = jest.fn()
jest.mock('expo-file-system', () => ({ File: jest.fn(() => ({ delete: mockDelete })) }))

const PICKED = 'file:///cache/ImagePicker/picked.png'


it('loads the picked file again on each call, so each caller owns its image', async () => {
  const first = { width: 1206 }
  const second = { width: 1206 }
  jest
    .mocked(loadImage)
    .mockResolvedValueOnce(first as never)
    .mockResolvedValueOnce(second as never)
  const still = stillPhoto(PICKED)
  await expect(still.toImageAsync()).resolves.toBe(first)
  await expect(still.toImageAsync()).resolves.toBe(second)
  expect(loadImage).toHaveBeenCalledWith({ filePath: PICKED })
})

it('deletes the picked file', () => {
  deletePickedImage(PICKED)
  expect(File).toHaveBeenCalledWith(PICKED)
  expect(mockDelete).toHaveBeenCalledTimes(1)
})

it('does not throw when the picked file is already gone', () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  mockDelete.mockImplementationOnce(() => {
    throw new Error('no such file')
  })
  expect(() => deletePickedImage(PICKED)).not.toThrow()
})
