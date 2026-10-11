import type { CameraOrientation } from 'react-native-vision-camera'
import type { Quad } from '../scanner'

export type ViewSize = { width: number; height: number }

/** Two aspects that differ by at most this share count as the same field of view. */
export const ASPECT_TOLERANCE = 0.01

/** False when either aspect is not a positive number. */
export function sameAspect(a: number, b: number): boolean {
  return a > 0 && b > 0 && Math.abs(a / b - 1) <= ASPECT_TOLERANCE
}

/** width ÷ height of the frame after it is turned upright. */
export function uprightAspect(width: number, height: number, orientation: CameraOrientation): number {
  'worklet'
  return orientation === 'left' || orientation === 'right' ? height / width : width / height
}

/**
 * Maps a normalised quad to view points. The preview fills the view and crops the frame
 * ('cover', the VisionCamera default). Null before the view has a size, and when the aspect is not a positive number.
 */
export function toPreview(quad: Quad, aspect: number, view: ViewSize): Quad | null {
  'worklet'
  if (view.width <= 0 || view.height <= 0 || !(aspect > 0)) return null
  const height = Math.max(view.height, view.width / aspect)
  const width = height * aspect
  const left = (view.width - width) / 2
  const top = (view.height - height) / 2
  return quad.map((p) => ({ x: left + p.x * width, y: top + p.y * height })) as Quad
}
