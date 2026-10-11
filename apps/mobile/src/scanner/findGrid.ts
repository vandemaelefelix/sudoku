import {
  AdaptiveThresholdTypes,
  ColorConversionCodes,
  ContourApproximationModes,
  DataTypes,
  Mat,
  OpenCV,
  PointVector,
  PointVectorOfVectors,
  RetrievalModes,
  Size,
  ThresholdTypes,
} from 'react-native-fast-opencv'
import { type GridDetection, MIN_AREA_FRACTION, toGridDetection } from './quad'
import type { Point } from '@/utils/geometry.utils'

const BLUR_SIZE = 5
const THRESHOLD_BLOCK = 11
const THRESHOLD_C = 2
/** The largest distance between a contour and its polygon, as a share of the contour length. */
const APPROX_EPSILON = 0.02

type Releasable = { release(): void }

/**
 * pixels: interleaved RGB, uint8, width × height. Returns the normalised quad and the score of the largest plausible 4-corner contour, or null.
 * Releases every OpenCV object before it returns or throws.
 */
export function findGrid(pixels: Uint8Array, width: number, height: number): GridDetection | null {
  'worklet'
  // Garbage collection in the worklet runtime can lag, so each object is released here (ADR-002).
  const owned: Releasable[] = []
  function own<T extends Releasable>(object: T): T {
    owned.push(object)
    return object
  }
  try {
    const rgb = own(Mat.createFromBuffer('uint8', height, width, 3, pixels))
    const gray = own(Mat.create(height, width, DataTypes.CV_8U))
    OpenCV.cvtColor(rgb, gray, ColorConversionCodes.COLOR_RGB2GRAY)
    OpenCV.GaussianBlur(gray, gray, own(Size.create(BLUR_SIZE, BLUR_SIZE)), 0)
    const binary = own(Mat.create(height, width, DataTypes.CV_8U))
    OpenCV.adaptiveThreshold(
      gray,
      binary,
      255,
      AdaptiveThresholdTypes.ADAPTIVE_THRESH_GAUSSIAN_C,
      ThresholdTypes.THRESH_BINARY_INV,
      THRESHOLD_BLOCK,
      THRESHOLD_C,
    )
    const contours = own(PointVectorOfVectors.create())
    OpenCV.findContours(binary, contours, RetrievalModes.RETR_EXTERNAL, ContourApproximationModes.CHAIN_APPROX_SIMPLE)

    const minArea = MIN_AREA_FRACTION * width * height
    const candidates: { contour: PointVector; area: number }[] = []
    for (let i = 0; i < contours.length; i++) {
      const contour = own(contours.get(i))
      const area = OpenCV.contourArea(contour).value
      if (area >= minArea) candidates.push({ contour, area })
    }
    candidates.sort((a, b) => b.area - a.area)

    for (const { contour } of candidates) {
      const corners = own(PointVector.create())
      OpenCV.approxPolyDP(contour, corners, APPROX_EPSILON * OpenCV.arcLength(contour, true).value, true)
      if (corners.length !== 4) continue
      const points: Point[] = []
      for (let i = 0; i < 4; i++) {
        const corner = own(corners.get(i))
        points.push({ x: corner.x, y: corner.y })
      }
      const detection = toGridDetection(points, width, height)
      if (detection != null) return detection
    }
    return null
  } finally {
    for (const object of owned) object.release()
  }
}
