import { MAX_JPEG_BYTES } from '@sudoku/scan-contract'
import type { Quad, Rect } from '@/utils/geometry.utils'
import { CROP_MARGIN, JPEG_QUALITIES, MAX_PHOTO_SIDE } from './constants/scanShare.constants'

/** The part of an image library that cropPhoto uses. `render` draws `source` (pixels of the file) at `out` size and encodes a JPEG. */
export type ImageCodec = {
  size(uri: string): Promise<{ width: number; height: number }>
  render(uri: string, source: Rect, out: { width: number; height: number }, quality: number): Promise<Uint8Array>
}

export type CroppedPhoto = {
  jpeg: Uint8Array
  width: number
  height: number
  /** TL, TR, BR, BL, normalised to the cropped photo. */
  corners: [number, number][]
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** quad: normalised to the photo. The result stays inside the photo and holds the whole grid. */
export function cropRegion(quad: Quad, photo: { width: number; height: number }, margin = CROP_MARGIN) {
  const xs = quad.map((p) => p.x * photo.width)
  const ys = quad.map((p) => p.y * photo.height)
  const side = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  const left = Math.max(0, Math.floor(Math.min(...xs) - side * margin))
  const top = Math.max(0, Math.floor(Math.min(...ys) - side * margin))
  const right = Math.min(photo.width, Math.ceil(Math.max(...xs) + side * margin))
  const bottom = Math.min(photo.height, Math.ceil(Math.max(...ys) + side * margin))
  const source: Rect = { x: left, y: top, width: right - left, height: bottom - top }
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(source.width, source.height))
  const out = {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  }
  const corners = quad.map((p): [number, number] => [
    clamp01((p.x * photo.width - left) / source.width),
    clamp01((p.y * photo.height - top) / source.height),
  ])
  return { source, out, corners }
}

/**
 * Crops the upright photo to the grid plus a margin, at most MAX_PHOTO_SIDE pixels on the long side. The JPEG is encoded again,
 * so it has no EXIF and no position. A photo over MAX_JPEG_BYTES is encoded again at a lower quality. Throws when none fits.
 */
export async function cropPhoto(codec: ImageCodec, uri: string, quad: Quad): Promise<CroppedPhoto> {
  const { source, out, corners } = cropRegion(quad, await codec.size(uri))
  for (const quality of JPEG_QUALITIES) {
    // oxlint-disable-next-line no-await-in-loop -- each try needs the size of the one before it.
    const jpeg = await codec.render(uri, source, out, quality)
    if (jpeg.length <= MAX_JPEG_BYTES) return { jpeg, width: out.width, height: out.height, corners }
  }
  throw new RangeError(`the cropped photo is larger than ${MAX_JPEG_BYTES} bytes at the lowest quality`)
}
