import { SCAN_SCHEMA_VERSION, validateScanRecord, type ScanCell, type ScanRecord } from '@sudoku/scan-contract'
import { type CellResult, KIND_CLASSES } from '@/scanner'
import type { FinalGrid } from '@/utils/finalGrid.utils'

/** A cell with the full model output. `RecogniseResult` cells carry both probability rows. */
export type ProbedCell = CellResult & { digitProbs: number[]; kindProbs: number[] }

export type RecordInput = {
  scanId: string
  contributorId: string
  appVersion: string
  modelVersion: string
  /** TL, TR, BR, BL, normalised to the cropped photo. */
  corners: [number, number][]
  cells: readonly CellResult[]
  finalGrid: FinalGrid
}

function isProbed(cell: CellResult | undefined): cell is ProbedCell {
  return cell?.digitProbs !== undefined && cell.kindProbs !== undefined
}

/**
 * `edited` is true when the player changed the digit or the kind that the correction screen showed for the cell.
 * Returns null when a cell has no probabilities or the record breaks the contract: the scan is then not shared.
 */
export function buildRecord(input: RecordInput): ScanRecord | null {
  const cells: ScanCell[] = []
  for (const [index, cell] of input.cells.entries()) {
    const final = input.finalGrid[index]
    if (!isProbed(cell) || final === undefined) return null
    cells.push({
      digitProbs: cell.digitProbs,
      kindProbs: cell.kindProbs,
      finalDigit: final.digit,
      finalKind: KIND_CLASSES.indexOf(final.kind),
      edited: final.digitCorrected || final.kindCorrected,
    })
  }
  const checked = validateScanRecord({
    schemaVersion: SCAN_SCHEMA_VERSION,
    scanId: input.scanId,
    contributorId: input.contributorId,
    appVersion: input.appVersion,
    modelVersion: input.modelVersion,
    corners: input.corners,
    cells,
  })
  return checked.ok ? checked.record : null
}
