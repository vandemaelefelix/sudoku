import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia'
import { photoToSkImage } from './photoImage'

function setup(pixelFormat: string, size = { width: 2376, height: 4224 }) {
  const buffer = new ArrayBuffer(16)
  const small = {
    dispose: jest.fn(),
    toRawPixelDataAsync: jest.fn(async () => ({ buffer, width: 900, height: 1600, pixelFormat })),
  }
  const full = { ...size, dispose: jest.fn(), resizeAsync: jest.fn(async () => small) }
  const photo = { toImageAsync: jest.fn(async () => full) }
  return { photo: photo as never, full, small }
}

beforeEach(() => jest.clearAllMocks())

it('resizes to the long side before it reads the pixels, and builds a Skia image', async () => {
  const { photo, full } = setup('BGRA')
  const image = await photoToSkImage(photo, 1600)
  expect(full.resizeAsync).toHaveBeenCalledWith(900, 1600)
  expect(Skia.Image.MakeImage).toHaveBeenCalledWith(
    { width: 900, height: 1600, colorType: ColorType.BGRA_8888, alphaType: AlphaType.Premul },
    expect.anything(),
    3600,
  )
  expect(image).toBe(jest.mocked(Skia.Image.MakeImage).mock.results[0]!.value)
})

it('does not enlarge a small photo', async () => {
  const { photo, full } = setup('BGRA', { width: 800, height: 600 })
  await photoToSkImage(photo, 1600)
  expect(full.resizeAsync).toHaveBeenCalledWith(800, 600)
})

it.each([
  ['BGRA', ColorType.BGRA_8888],
  ['BGRX', ColorType.BGRA_8888],
  ['RGBA', ColorType.RGBA_8888],
  ['RGBX', ColorType.RGBA_8888],
])('picks the colour type from the pixel format %s', async (pixelFormat, colorType) => {
  const { photo } = setup(pixelFormat)
  await photoToSkImage(photo, 1600)
  expect(jest.mocked(Skia.Image.MakeImage).mock.calls[0]![0]).toMatchObject({ colorType })
})

it('disposes both nitro images', async () => {
  const { photo, full, small } = setup('BGRA')
  await photoToSkImage(photo, 1600)
  expect(full.dispose).toHaveBeenCalledTimes(1)
  expect(small.dispose).toHaveBeenCalledTimes(1)
})

it('throws on another pixel format and still disposes', async () => {
  const { photo, full, small } = setup('RGB')
  await expect(photoToSkImage(photo, 1600)).rejects.toThrow('pixel format RGB')
  expect(full.dispose).toHaveBeenCalledTimes(1)
  expect(small.dispose).toHaveBeenCalledTimes(1)
})

it('throws when Skia returns no image', async () => {
  const { photo } = setup('BGRA')
  jest.mocked(Skia.Image.MakeImage).mockReturnValueOnce(null)
  await expect(photoToSkImage(photo, 1600)).rejects.toThrow('Skia could not make an image')
})
