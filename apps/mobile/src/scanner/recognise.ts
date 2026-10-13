import { type CellResult, decodeOutputs, type OutputIndex, runModel, type TfliteModel } from './classifier'
import { findGrid, findGrids } from './findGrid'
import { cornerOffset, downscaleSize, fromCrop, searchRect, toPhotoPixels } from './photoGeometry'
import { cropRgb, FLAT_SIZE, type RawPixels, sliceCells, toRgb } from './pixels'
import { preprocessCells } from './preprocess'
import { warpGrid } from './warp'
import type { Quad } from '@/utils/geometry.utils'
import { errorMessage } from '@/utils/log.utils'

// Scan-pipeline concept, "Threads and coordinates". Every function here runs on the scanner runtime.

/** The part of a nitro-image Image that recognise uses. */
export type ImageSource = {
  width: number
  height: number
  resize(width: number, height: number): ImageSource
  toRawPixelData(): RawPixels
  dispose(): void
}

/** The part of a VisionCamera Photo that recognise uses. toImage applies the EXIF orientation. */
export type PhotoSource = { toImage(): ImageSource }

/** redetected: the grid in the photo nearest the locked quad. found: the largest grid in the photo, after a shutter press without a grid. */
export type CornerSource = 'redetected' | 'found'

/** Milliseconds. */
export type RecogniseTimings = { imageMs: number; detectMs: number; flattenMs: number; classifyMs: number }

/** quad: the corners used, normalised to the upright photo. cornerOffset: of the re-detected corners from the locked quad, as a share of the grid side, or null. */
export type RecogniseResult =
  | {
      ok: true
      cells: CellResult[]
      quad: Quad
      corners: CornerSource
      cornerOffset: number | null
      timings: RecogniseTimings
      /** The 576 × 576 flattened grid the cells were cut from, RGB. useCapture moves it to flatPath and drops it. */
      flat?: Uint8Array
      /** A temporary file with the upright capture photo. useCapture sets it in development builds. */
      photoPath?: string
      /** A temporary PNG file with the flattened grid. useCapture sets it in development builds. */
      flatPath?: string
    }
  | { ok: false; reason: string }

/**
 * A grid in the photo farther than this share of the grid side from the locked quad is another grid. The grids on one page lie
 * about one side apart, and a hand moves the phone much less between lock-on and the photo.
 */
export const MATCH_TOLERANCE = 0.5
/** The search box around the locked quad grows by this share of its size on each side. */
export const SEARCH_GROW = 0.1

type Located = { quad: Quad; corners: CornerSource; cornerOffset: number | null }
type Match = { quad: Quad; offset: number }

function nearest(candidates: Quad[], quad: Quad, width: number, height: number): Match | null {
  'worklet'
  let best: Match | null = null
  for (const candidate of candidates) {
    const offset = cornerOffset(candidate, quad, width, height)
    if (offset <= MATCH_TOLERANCE && (best == null || offset < best.offset)) best = { quad: candidate, offset }
  }
  return best
}

/**
 * small: the RGB photo, width × height. quad: the locked quad, normalised, or null. The corners always come from the photo: the
 * locked quad only chooses the grid, because the phone can move between lock-on and the photo. Null when the photo has no grid.
 */
export function locateGrid(small: Uint8Array, width: number, height: number, quad: Quad | null): Located | null {
  'worklet'
  if (quad == null) {
    const found = findGrid(small, width, height)
    return found == null ? null : { quad: found.quad, corners: 'found', cornerOffset: null }
  }
  // The box search is cheaper, so it comes first. The search of the whole photo finds a grid that moved out of the box.
  const rect = searchRect(quad, width, height, SEARCH_GROW)
  const inBox = findGrids(cropRgb(small, width, rect), rect.width, rect.height)
  const match =
    nearest(
      inBox.map((found) => fromCrop(found.quad, rect, width, height)),
      quad,
      width,
      height,
    ) ??
    nearest(
      findGrids(small, width, height).map((found) => found.quad),
      quad,
      width,
      height,
    )
  return match == null ? null : { quad: match.quad, corners: 'redetected', cornerOffset: match.offset }
}

/** quad: the locked quad, normalised to the upright frame, or null for a shutter press without a grid. Never throws. */
export function recognise(
  photo: PhotoSource,
  quad: Quad | null,
  model: TfliteModel,
  outputs: OutputIndex,
): RecogniseResult {
  'worklet'
  const images: ImageSource[] = []
  try {
    let started = Date.now()
    const image = photo.toImage()
    images.push(image)
    const size = downscaleSize(image.width, image.height)
    const small = image.resize(size.width, size.height)
    images.push(small)
    const smallRaw = small.toRawPixelData()
    const smallRgb = toRgb(smallRaw)
    // The raw pixels of the photo image keep the sensor orientation. A resize draws them upright.
    const upright = image.resize(image.width, image.height)
    images.push(upright)
    const full = upright.toRawPixelData()
    const imageMs = Date.now() - started

    started = Date.now()
    const located = locateGrid(smallRgb, smallRaw.width, smallRaw.height, quad)
    if (located == null) return { ok: false, reason: 'no grid in the photo' }
    const detectMs = Date.now() - started

    started = Date.now()
    const flat = toRgb(warpGrid(full, toPhotoPixels(located.quad, full.width, full.height), FLAT_SIZE))
    const cellImages = sliceCells(flat)
    const flattenMs = Date.now() - started

    started = Date.now()
    const cells = decodeOutputs(runModel(model, outputs, preprocessCells(cellImages)))
    const classifyMs = Date.now() - started

    return {
      ok: true,
      cells,
      quad: located.quad,
      corners: located.corners,
      cornerOffset: located.cornerOffset,
      flat,
      timings: { imageMs, detectMs, flattenMs, classifyMs },
    }
  } catch (error) {
    return { ok: false, reason: errorMessage(error) }
  } finally {
    for (const image of images) image.dispose()
  }
}
