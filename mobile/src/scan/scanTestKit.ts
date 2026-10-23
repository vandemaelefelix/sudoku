import type { SharedValue } from 'react-native-reanimated'
import type { CellResult } from '@/scanner'
import type { CaptureSession } from '@/scan/hooks/useCaptureSession'
import type { CaptureOk, CaptureResult, ScanOrigin } from '@/scan/utils/captureResult.utils'

/** The part of the capture session that the correction screen and the correction session read. */
export type ScanSession = Pick<
  CaptureSession,
  'phase' | 'origin' | 'result' | 'crossFade' | 'clock' | 'waiting' | 'resultsAt'
>

const shared = <T>(value: T) => ({ value }) as SharedValue<T>

function share<T>(value: T | SharedValue<T> | undefined, fallback: T): SharedValue<T> {
  if (typeof value === 'object' && value !== null && 'value' in value) return value
  return shared(value ?? fallback)
}

/** An empty cell that the scanner is sure of. */
export const emptyCell = (): CellResult => ({ digit: 0, kind: 'none', confidence: 1, validPair: true, second: 1 })

/** A printed digit. A confidence below the review threshold gives the cell a ring. */
export const printed = (digit: number, confidence = 1): Partial<CellResult> => ({ digit, kind: 'printed', confidence })

/** An ok result with 81 empty cells. over: the cells to change, by index. extra: the fields that the scan UI adds, such as photoPath. */
export function okResult(over: { [n: number]: Partial<CellResult> } = {}, extra: Partial<CaptureOk> = {}): CaptureOk {
  const cells = Array.from({ length: 81 }, (_, n) => ({ ...emptyCell(), ...over[n] }))
  return {
    ok: true,
    cells,
    quad: [] as never,
    corners: 'detected' as never,
    cornerOffset: null,
    timings: {} as never,
    ...extra,
  }
}

/** The finished scan: the player can edit, and every layer shows. */
export const review = (result: CaptureResult | null, origin: ScanOrigin = 'camera'): ScanSession => ({
  phase: 'review',
  origin,
  result,
  crossFade: false,
  clock: shared(0),
  waiting: shared(false),
  resultsAt: shared(0),
})

/**
 * The transition: the clock drives the layers. The results arrived at 0 unless the test says otherwise, so the sweep does not
 * shift. clock, resultsAt and waiting take a value or a shared value. A test that changes the value later passes a shared value.
 */
export const capturing = (
  result: CaptureResult | null,
  over: {
    clock?: number | SharedValue<number>
    resultsAt?: number | SharedValue<number>
    waiting?: boolean | SharedValue<boolean>
    crossFade?: boolean
  } = {},
): ScanSession => ({
  phase: 'capturing',
  origin: 'camera',
  result,
  crossFade: over.crossFade ?? false,
  clock: share(over.clock, 0),
  waiting: share(over.waiting, false),
  resultsAt: share(over.resultsAt, 0),
})
