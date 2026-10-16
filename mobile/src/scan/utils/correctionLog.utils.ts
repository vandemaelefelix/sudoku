import manifest from '@assets/models/manifest.json'
import type { CellResult } from '@/scanner'
import type { Quad } from '@/utils/geometry.utils'
import { type CellLook, cellLook } from './correction.utils'

/** The scan.json of a corrected scan. Row and col count from 0. The corners are normalised to the upright photo. */
export type ScanRecord = {
  savedAt: string
  modelRun: string | undefined
  corners: Quad
  cells: {
    row: number
    col: number
    model: { digit: number; kind: CellResult['kind']; confidence: number }
    final: { digit: number; kind: CellResult['kind'] }
    digitCorrected: boolean
    kindCorrected: boolean
  }[]
}

/** An empty cell has the kind none. A given is printed and an entry is handwritten, as on the correction screen. */
function finalOf(look: CellLook): ScanRecord['cells'][number]['final'] {
  if (look.style === 'empty') return { digit: 0, kind: 'none' }
  return { digit: Number(look.digit), kind: look.style === 'given' ? 'printed' : 'handwritten' }
}

/** The record of a scan. looks: the 81 final looks, row by row. A scan with no correction has every flag false. */
export function buildScanRecord(
  cells: readonly CellResult[],
  looks: readonly CellLook[],
  corners: Quad,
  savedAt: string,
  modelRun: string | undefined = manifest.run,
): ScanRecord {
  const saved: ScanRecord['cells'] = cells.map((cell, index) => {
    const before = cellLook(cell)
    const look = looks[index] ?? before
    return {
      row: Math.floor(index / 9),
      col: index % 9,
      model: { digit: cell.digit, kind: cell.kind, confidence: cell.confidence },
      final: finalOf(look),
      digitCorrected: look.digit !== before.digit,
      kindCorrected: look.style !== before.style,
    }
  })
  return { savedAt, modelRun, corners, cells: saved }
}
