import { BorderTypes, DataTypes, InterpolationFlags, Mat, OpenCV, Scalar, Size } from 'react-native-fast-opencv'
import { bytesPerPixel, type RawPixels, rowBytes } from './pixels'
import type { Quad } from '@/utils/geometry.utils'
import { quadToQuad } from '@/utils/homography.utils'

type Releasable = { release(): void }

/**
 * corners: OpenCV pixels in raw, in quad order. Returns side × side pixels in the pixel format of raw.
 * Releases every OpenCV object before it returns or throws.
 */
export function warpGrid(raw: RawPixels, corners: Quad, side: number): RawPixels {
  'worklet'
  // Garbage collection in a worklet runtime can lag, so each object is released here (ADR-002).
  const owned: Releasable[] = []
  function own<T extends Releasable>(object: T): T {
    owned.push(object)
    return object
  }
  try {
    const channels = bytesPerPixel(raw.pixelFormat)
    const row = rowBytes(raw)
    if (row % channels !== 0) throw new RangeError(`a row of ${row} bytes is not whole ${raw.pixelFormat} pixels`)
    // A padded row becomes extra columns on the right. The warp reads only inside the grid, so they never show.
    const src = own(
      Mat.createFromBuffer('uint8', raw.height, row / channels, channels as 3 | 4, new Uint8Array(raw.buffer)),
    )
    // Pixel centres are on integers, so the edges of the square are at -0.5 and side - 0.5.
    const edge = side - 0.5
    const squareCorners: Quad = [
      { x: -0.5, y: -0.5 },
      { x: edge, y: -0.5 },
      { x: edge, y: edge },
      { x: -0.5, y: edge },
    ]
    // fast-opencv 1.0.1 drops the points of Point2fVector.create, so the transform comes from TypeScript.
    const h = quadToQuad(corners, squareCorners)
    if (h === null) throw new Error('the corners do not give a perspective transform')
    const transform = own(Mat.create(3, 3, DataTypes.CV_64F, h))
    // warpPerspective gives dst the type of src.
    const dst = own(Mat.create(side, side, DataTypes.CV_8U))
    OpenCV.warpPerspective(
      src,
      dst,
      transform,
      own(Size.create(side, side)),
      InterpolationFlags.INTER_LINEAR,
      BorderTypes.BORDER_REPLICATE,
      own(Scalar.create(0)),
    )
    // A copy: the buffer of toBuffer can belong to the Mat, which is released below.
    const pixels = dst.toBuffer('uint8').buffer.slice()
    return { buffer: pixels.buffer, width: side, height: side, pixelFormat: raw.pixelFormat }
  } finally {
    for (const object of owned) object.release()
  }
}
