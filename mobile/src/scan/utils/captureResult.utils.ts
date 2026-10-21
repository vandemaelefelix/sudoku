import type { SkImage } from '@shopify/react-native-skia'
import type { RecogniseResult } from '@/scanner'
import { flatToSkImage, saveFlatPng } from '@/scan/utils/flatImage.utils'
import { devWarn, errorMessage } from '@/utils/log.utils'

type ScannerOk = Extract<RecogniseResult, { ok: true }>

/**
 * What the scan UI keeps of an ok result. flatImage: the flattened grid as a Skia image, for the cell crops of the correction
 * screen, set in every build. photoPath: a temporary file with the upright capture photo, set when the photo was kept
 * (development builds, or sharing on). flatPath: a temporary PNG of the flattened grid, set in development builds.
 */
export type CaptureOk = Omit<ScannerOk, 'flat'> & { flatImage?: SkImage; photoPath?: string; flatPath?: string }

/** The result of one capture: the scanner result with the files and images that the scan UI adds. */
export type CaptureResult = CaptureOk | Extract<RecogniseResult, { ok: false }>

/**
 * The flattened grid never enters React state as bytes. A development build took 2.6 s to render a result with this 1 MB array
 * on an iPhone 17 Pro, and the transition waited for it. The result keeps it as a Skia image instead: the check state of the
 * correction screen cuts the cell crops from it. Development builds also keep it in a file, to save it with the corrections.
 * photoPath: the saved photo, or null when the photo was not kept.
 */
export function toCaptureResult(result: RecogniseResult, photoPath: string | null): CaptureResult {
  if (!result.ok) return result
  const { flat, ...rest } = result
  let kept: CaptureOk = rest
  if (flat != null) {
    try {
      const flatImage = flatToSkImage(flat)
      if (flatImage != null) kept = { ...rest, flatImage }
    } catch (error) {
      devWarn('scan', `the flattened grid has no image: ${errorMessage(error)}`)
    }
  }
  if (photoPath == null) return kept
  if (!__DEV__) return { ...kept, photoPath }
  let flatPath: string | undefined
  try {
    flatPath = flat == null ? undefined : saveFlatPng(flat)
  } catch (error) {
    devWarn('scan', `the flattened grid is not saved: ${errorMessage(error)}`)
  }
  return flatPath == null ? { ...kept, photoPath } : { ...kept, photoPath, flatPath }
}

/** photoMs: from capture to the photo. totalMs: from capture to the result. */
export function formatScanLog(photoMs: number, totalMs: number, result: CaptureResult): string {
  if (!result.ok) return `[scan] failed after ${totalMs} ms: ${result.reason}`
  const t = result.timings
  const offset = result.cornerOffset == null ? '' : `, offset ${(result.cornerOffset * 100).toFixed(1)} %`
  return (
    `[scan] photo ${photoMs} ms, image ${t.imageMs} ms, detect ${t.detectMs} ms (${result.corners}${offset}), ` +
    `flatten ${t.flattenMs} ms, classify ${t.classifyMs} ms, total ${totalMs} ms`
  )
}
