import { type CellResult, decodeOutputs, type OutputIndex, runModel, type TfliteModel } from './classifier'
import { findGrid } from './findGrid'
import { cornerOffset, downscaleSize, fromCrop, searchRect, toPhotoPixels } from './photoGeometry'
import { cropRgb, FLAT_SIZE, type RawPixels, sliceCells, toRgb } from './pixels'
import { preprocessCells } from './preprocess'
import type { Quad } from './quad'
import { warpGrid } from './warp'

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

/** redetected: found near the locked quad. locked: the locked quad itself. found: a search of the whole photo, after a shutter press without a grid. */
export type CornerSource = 'redetected' | 'locked' | 'found'

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
    }
  | { ok: false; reason: string }

/** A re-detected corner farther than this share of the grid side from the locked corner belongs to another grid. */
export const CORNER_TOLERANCE = 0.04
/** The search box around the locked quad grows by this share of its size on each side. */
export const SEARCH_GROW = 0.1

type Located = { quad: Quad; corners: CornerSource; cornerOffset: number | null }

/** small: the RGB photo, width × height. quad: the locked quad, normalised, or null. Null when there is no quad and no grid. */
export function locateGrid(small: Uint8Array, width: number, height: number, quad: Quad | null): Located | null {
  'worklet'
  if (quad == null) {
    const found = findGrid(small, width, height)
    return found == null ? null : { quad: found.quad, corners: 'found', cornerOffset: null }
  }
  const rect = searchRect(quad, width, height, SEARCH_GROW)
  const found = findGrid(cropRgb(small, width, rect), rect.width, rect.height)
  if (found == null) return { quad, corners: 'locked', cornerOffset: null }
  const candidate = fromCrop(found.quad, rect, width, height)
  const offset = cornerOffset(candidate, quad, width, height)
  return offset <= CORNER_TOLERANCE
    ? { quad: candidate, corners: 'redetected', cornerOffset: offset }
    : { quad, corners: 'locked', cornerOffset: offset }
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
      timings: { imageMs, detectMs, flattenMs, classifyMs },
    }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  } finally {
    for (const image of images) image.dispose()
  }
}
