import manifest from '@assets/models/manifest.json'
import type { CellResult } from '@/scanner'
import type { FinalGrid } from '@/utils/finalGrid.utils'
import type { Quad } from '@/utils/geometry.utils'

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

/** The record of a scan. finalGrid: the 81 final cells, row by row. A scan with no correction has every flag false. */
export function buildScanRecord(
  cells: readonly CellResult[],
  finalGrid: FinalGrid,
  corners: Quad,
  savedAt: string,
  modelRun: string | undefined = manifest.run,
): ScanRecord {
  const saved: ScanRecord['cells'] = cells.map((cell, index) => {
    const { digit, kind, digitCorrected, kindCorrected } = finalGrid[index] ?? {
      digit: cell.digit,
      kind: cell.kind,
      digitCorrected: false,
      kindCorrected: false,
    }
    return {
      row: Math.floor(index / 9),
      col: index % 9,
      model: { digit: cell.digit, kind: cell.kind, confidence: cell.confidence },
      final: { digit, kind },
      digitCorrected,
      kindCorrected,
    }
  })
  return { savedAt, modelRun, corners, cells: saved }
}
