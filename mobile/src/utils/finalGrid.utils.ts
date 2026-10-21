/**
 * One cell of a scan as the player left it. digit: 0 is empty. kind: none for an empty cell, notes for a pencil-marked cell, printed
 * for a given and handwritten for an entry. digitCorrected and kindCorrected: the player changed what the scanner read.
 */
export type FinalCell = {
  digit: number
  kind: 'none' | 'printed' | 'handwritten' | 'notes'
  digitCorrected: boolean
  kindCorrected: boolean
}

/** The 81 final cells, row by row. The scan UI builds it. The development scan log and the scan upload (ADR-030) read it. */
export type FinalGrid = readonly FinalCell[]
