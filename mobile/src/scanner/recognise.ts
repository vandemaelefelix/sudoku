import { type CellResult, decodeOutputs, type OutputIndex, runModel, type TfliteModel } from './classifier'
import { firstFind } from './chooseGrid'
import { findGrids } from './findGrid'
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
      /** The 576 × 576 flattened grid the cells were cut from, RGB. The scan UI turns it into an image and drops it. */
      flat?: Uint8Array
    }
  | { ok: false; reason: string }

/** The failure reason when the photo or the still image has no grid. */
export const NO_GRID = 'no grid in the photo'

/**
 * A grid in the photo farther than this share of the grid side from the locked quad is another grid. The grids on one page lie
 * about one side apart, and a hand moves the phone much less between lock-on and the photo.
 */
export const MATCH_TOLERANCE = 0.5
/** The search box around the locked quad grows by this share of its size on each side. */
export const SEARCH_GROW = 0.1

/**
 * The still path searches again inside the found quad: its bounding box shrinks by this share of its size on each side. The cut
 * goes through the edge of a page, so the page does not count again. Inside a grid the cut goes through the grid lines, so the
 * line network touches the edge of the crop and gives no quad.
 */
export const INNER_INSET = 0.03
/** The most searches inside a found quad: a grid on a page on a sheet. */
export const MAX_DEPTH = 3
/**
 * The long side of the full read of a still image, in px. A library image can have 48 MP, and its RGBA read alone takes about
 * 190 MB. The camera photo has about 8 MP. The flatten needs only FLAT_SIZE px of grid.
 */
export const STILL_MAX_SIDE = 4032

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
    // No aim: the grid nearest the centre, of the grids that pass the area rule of the live chooser.
    const found = firstFind(findGrids(small, width, height), width / height)
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

/**
 * small: the RGB still image, width × height. findGrids keeps only the outer contours, so a photo of a whole page finds the page.
 * The grid lies inside it, so the search goes on inside each found quad while it finds one. At each level firstFind takes the
 * grid nearest the centre, so a page of several sudokus gives the middle one. Null when the image has no grid.
 */
export function locateStill(small: Uint8Array, width: number, height: number): Located | null {
  'worklet'
  const found = firstFind(findGrids(small, width, height), width / height)
  if (found == null) return null
  let quad = found.quad
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const rect = searchRect(quad, width, height, -INNER_INSET)
    const inner = firstFind(findGrids(cropRgb(small, width, rect), rect.width, rect.height), rect.width / rect.height)
    if (inner == null) break
    quad = fromCrop(inner.quad, rect, width, height)
  }
  return { quad, corners: 'found', cornerOffset: null }
}

/**
 * image: the photo, or a still image. The steps after the first image read the same for both. maxSide: the long side of the full
 * read, in px. Disposes every image it makes, never the image it gets. Never throws.
 */
function recogniseImage(
  image: ImageSource,
  quad: Quad | null,
  still: boolean,
  maxSide: number,
  model: TfliteModel,
  outputs: OutputIndex,
  started: number,
): RecogniseResult {
  'worklet'
  const images: ImageSource[] = []
  try {
    const size = downscaleSize(image.width, image.height)
    const small = image.resize(size.width, size.height)
    images.push(small)
    const smallRaw = small.toRawPixelData()
    const smallRgb = toRgb(smallRaw)
    // The raw pixels of the photo image keep the sensor orientation. A resize draws them upright. A still image keeps its EXIF
    // orientation the same way.
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
    const upright = image.resize(Math.round(image.width * scale), Math.round(image.height * scale))
    images.push(upright)
    const full = upright.toRawPixelData()
    const imageMs = Date.now() - started

    let step = Date.now()
    const located = still
      ? locateStill(smallRgb, smallRaw.width, smallRaw.height)
      : locateGrid(smallRgb, smallRaw.width, smallRaw.height, quad)
    if (located == null) return { ok: false, reason: NO_GRID }
    const detectMs = Date.now() - step

    step = Date.now()
    const flat = toRgb(warpGrid(full, toPhotoPixels(located.quad, full.width, full.height), FLAT_SIZE))
    const cellImages = sliceCells(flat)
    const flattenMs = Date.now() - step

    step = Date.now()
    const cells = decodeOutputs(runModel(model, outputs, preprocessCells(cellImages)))
    const classifyMs = Date.now() - step

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
    for (const made of images) made.dispose()
  }
}

/** quad: the locked quad, normalised to the upright frame, or null for a shutter press without a grid. Never throws. */
export function recognise(
  photo: PhotoSource,
  quad: Quad | null,
  model: TfliteModel,
  outputs: OutputIndex,
): RecogniseResult {
  'worklet'
  const started = Date.now()
  let image: ImageSource
  try {
    image = photo.toImage()
  } catch (error) {
    return { ok: false, reason: errorMessage(error) }
  }
  try {
    return recogniseImage(image, quad, false, Infinity, model, outputs, started)
  } finally {
    image.dispose()
  }
}

/**
 * A still image from the photo library. It has no locked quad, so findGrids searches the whole image, then inside the quad it finds
 * (locateStill). The caller keeps the image and disposes it. Never throws.
 */
export function recogniseStill(image: ImageSource, model: TfliteModel, outputs: OutputIndex): RecogniseResult {
  'worklet'
  return recogniseImage(image, null, true, STILL_MAX_SIDE, model, outputs, Date.now())
}
