import { AlphaType, ColorType, ImageFormat, Skia, type SkImage } from '@shopify/react-native-skia'
import { File, Paths } from 'expo-file-system'

export const FLAT_SIDE = 576

/** RGB bytes (side × side) to RGBA bytes with full alpha, the form Skia reads. */
export function rgbToRgba(rgb: Uint8Array): Uint8Array {
  const rgba = new Uint8Array((rgb.length / 3) * 4)
  for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
    rgba[j] = rgb[i] ?? 0
    rgba[j + 1] = rgb[i + 1] ?? 0
    rgba[j + 2] = rgb[i + 2] ?? 0
    rgba[j + 3] = 255
  }
  return rgba
}

/** The flattened grid as a Skia image, or null when Skia cannot make one. The caller disposes it. */
export function flatToSkImage(flat: Uint8Array): SkImage | null {
  const data = Skia.Data.fromBytes(rgbToRgba(flat))
  try {
    return Skia.Image.MakeImage(
      { width: FLAT_SIDE, height: FLAT_SIDE, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Opaque },
      data,
      FLAT_SIDE * 4,
    )
  } finally {
    data.dispose()
  }
}

/** The flattened grid as PNG bytes. */
export function flatToPng(flat: Uint8Array): Uint8Array {
  const image = flatToSkImage(flat)
  if (image === null) throw new Error('Skia could not make an image of the flattened grid')
  try {
    return image.encodeToBytes(ImageFormat.PNG)
  } finally {
    image.dispose()
  }
}

/** Saves the flattened grid as a PNG in the cache folder and returns its file URI. */
export function saveFlatPng(flat: Uint8Array): string {
  const file = new File(Paths.cache, `flat-${Date.now()}.png`)
  file.create()
  file.write(flatToPng(flat))
  return file.uri
}
