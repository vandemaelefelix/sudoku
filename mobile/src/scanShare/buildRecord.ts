import { SCAN_SCHEMA_VERSION, validateScanRecord, type ScanCell, type ScanRecord } from '@sudoku/scan-contract'
import { type CellResult, KIND_CLASSES } from '@/scanner'
import { cellLook, type CellLook } from '@/scan/utils/correction.utils'

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
  /** The 81 final looks, row by row. */
  looks: readonly CellLook[]
}

function isProbed(cell: CellResult | undefined): cell is ProbedCell {
  return cell?.digitProbs !== undefined && cell.kindProbs !== undefined
}

/** An empty cell has digit 0 and kind none, a pencil-marked cell kind notes. A given is printed, an entry handwritten. */
function finalOf(look: CellLook): { digit: number; kind: string } {
  if (look.style === 'notes') return { digit: 0, kind: 'notes' }
  if (look.style === 'empty') return { digit: 0, kind: 'none' }
  return { digit: Number(look.digit), kind: look.style === 'given' ? 'printed' : 'handwritten' }
}

/**
 * `edited` is true when the player changed the digit or the kind that the correction screen showed for the cell.
 * Returns null when a cell has no probabilities or the record breaks the contract: the scan is then not shared.
 */
export function buildRecord(input: RecordInput): ScanRecord | null {
  const cells: ScanCell[] = []
  for (const [index, cell] of input.cells.entries()) {
    const look = input.looks[index]
    if (!isProbed(cell) || look === undefined) return null
    const shown = cellLook(cell)
    const final = finalOf(look)
    cells.push({
      digitProbs: cell.digitProbs,
      kindProbs: cell.kindProbs,
      finalDigit: final.digit,
      finalKind: KIND_CLASSES.indexOf(final.kind as (typeof KIND_CLASSES)[number]),
      edited: look.digit !== shown.digit || look.style !== shown.style,
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
