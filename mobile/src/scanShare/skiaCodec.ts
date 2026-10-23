import { ImageFormat, Skia } from '@shopify/react-native-skia'
import type { ImageCodec } from '@/scanShare/utils/cropPhoto.utils'

/** Skia draws the crop and encodes a new JPEG. The encoder writes no EXIF. Skia quality runs from 0 to 100. */
export const skiaCodec: ImageCodec = {
  async size(uri) {
    const image = await decode(uri)
    try {
      return { width: image.width(), height: image.height() }
    } finally {
      image.dispose()
    }
  },
  async render(uri, source, out, quality) {
    const image = await decode(uri)
    try {
      const surface = Skia.Surface.MakeOffscreen(out.width, out.height)
      if (surface === null) throw new Error('no offscreen surface')
      try {
        const rect = Skia.XYWHRect(source.x, source.y, source.width, source.height)
        surface.getCanvas().drawImageRect(image, rect, Skia.XYWHRect(0, 0, out.width, out.height), Skia.Paint())
        surface.flush()
        const snapshot = surface.makeImageSnapshot()
        try {
          return snapshot.encodeToBytes(ImageFormat.JPEG, Math.round(quality * 100))
        } finally {
          snapshot.dispose()
        }
      } finally {
        surface.dispose()
      }
    } finally {
      image.dispose()
    }
  },
}

async function decode(uri: string) {
  const data = await Skia.Data.fromURI(uri.startsWith('file:') ? uri : `file://${uri}`)
  const image = Skia.Image.MakeImageFromEncoded(data)
  if (image === null) throw new Error('the photo does not decode')
  return image
}
