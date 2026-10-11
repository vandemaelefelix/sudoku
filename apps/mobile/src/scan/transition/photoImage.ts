import { AlphaType, ColorType, Skia, type SkImage } from '@shopify/react-native-skia'
import type { Photo } from 'react-native-vision-camera'

/**
 * Upright Skia image of the photo, long side at most maxSide px. Disposes every nitro image and the pixel data it makes. Runs on the JS thread.
 * The resize comes first: the pixels of the photo itself are the sideways sensor buffer, and resize returns them upright (ADR-002).
 */
export async function photoToSkImage(photo: Pick<Photo, 'toImageAsync'>, maxSide: number): Promise<SkImage> {
  const full = await photo.toImageAsync()
  try {
    const scale = Math.min(1, maxSide / Math.max(full.width, full.height))
    const small = await full.resizeAsync(Math.round(full.width * scale), Math.round(full.height * scale))
    try {
      const { buffer, width, height, pixelFormat } = await small.toRawPixelDataAsync()
      const colorType = colorTypeOf(pixelFormat)
      // The resize can pad each row, so the buffer gives the row length, not the width.
      const rowBytes = buffer.byteLength / height
      if (!Number.isInteger(rowBytes) || rowBytes < width * 4) {
        throw new Error(`the photo has ${buffer.byteLength} bytes for ${height} rows of ${width} pixels`)
      }
      const alphaType = pixelFormat.endsWith('X') ? AlphaType.Opaque : AlphaType.Premul
      const data = Skia.Data.fromBytes(new Uint8Array(buffer))
      let image: SkImage | null
      try {
        image = Skia.Image.MakeImage({ width, height, colorType, alphaType }, data, rowBytes)
      } finally {
        // The image keeps its own reference to the pixels.
        data.dispose()
      }
      if (image == null) throw new Error('Skia could not make an image of the photo')
      return image
    } finally {
      small.dispose()
    }
  } finally {
    full.dispose()
  }
}

function colorTypeOf(pixelFormat: string): ColorType {
  if (pixelFormat === 'BGRA' || pixelFormat === 'BGRX') return ColorType.BGRA_8888
  if (pixelFormat === 'RGBA' || pixelFormat === 'RGBX') return ColorType.RGBA_8888
  throw new Error(`the photo has the pixel format ${pixelFormat}`)
}
