import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia'
import { photoToSkImage } from './photoImage.utils'

function setup(pixelFormat: string, size = { width: 2376, height: 4224 }, rowBytes = 900 * 4) {
  const buffer = new ArrayBuffer(rowBytes * 1600)
  const small = {
    dispose: jest.fn(),
    toRawPixelDataAsync: jest.fn(async () => ({ buffer, width: 900, height: 1600, pixelFormat })),
  }
  const full = { ...size, dispose: jest.fn(), resizeAsync: jest.fn(async () => small) }
  const photo = { toImageAsync: jest.fn(async () => full) }
  return { photo: photo as never, full, small }
}

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

it('reads the row bytes from the buffer, because a resize can pad the rows', async () => {
  const { photo } = setup('BGRA', undefined, 3648)
  await photoToSkImage(photo, 1600)
  expect(jest.mocked(Skia.Image.MakeImage).mock.calls[0]![2]).toBe(3648)
})

it.each([
  ['shorter than a row', 900 * 4 - 4],
  ['not a whole number per row', 900 * 4 + 0.5],
])('throws and disposes when the buffer is %s', async (_name, rowBytes) => {
  const { photo, full, small } = setup('BGRA', undefined, rowBytes)
  await expect(photoToSkImage(photo, 1600)).rejects.toThrow('row')
  expect(full.dispose).toHaveBeenCalledTimes(1)
  expect(small.dispose).toHaveBeenCalledTimes(1)
})

it.each([
  ['BGRA', AlphaType.Premul],
  ['BGRX', AlphaType.Opaque],
  ['RGBA', AlphaType.Premul],
  ['RGBX', AlphaType.Opaque],
])('picks the alpha type from the pixel format %s', async (pixelFormat, alphaType) => {
  const { photo } = setup(pixelFormat)
  await photoToSkImage(photo, 1600)
  expect(jest.mocked(Skia.Image.MakeImage).mock.calls[0]![0]).toMatchObject({ alphaType })
})

it('disposes the pixel data once Skia made the image, and also when it could not', async () => {
  const { photo } = setup('BGRA')
  await photoToSkImage(photo, 1600)
  const data = jest.mocked(Skia.Data.fromBytes).mock.results[0]!.value
  expect(jest.mocked(Skia.Image.MakeImage).mock.calls[0]![1]).toBe(data)
  expect(data.dispose).toHaveBeenCalledTimes(1)
  jest.mocked(Skia.Image.MakeImage).mockReturnValueOnce(null)
  await expect(photoToSkImage(setup('BGRA').photo, 1600)).rejects.toThrow('Skia')
  expect(jest.mocked(Skia.Data.fromBytes).mock.results[1]!.value.dispose).toHaveBeenCalledTimes(1)
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
