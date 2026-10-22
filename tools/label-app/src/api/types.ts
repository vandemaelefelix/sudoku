// The JSON of the label server (ml/src/sudoku_ml/label_server.py). ml/tests/api_schemas.py holds the
// same shapes as JSON Schemas: a change of one needs the same change in the other (ADR-034).

export const DIGITS = ['empty', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const
export type Digit = (typeof DIGITS)[number]
/** A digit, or `discarded` for a bad cut or an unreadable mark. */
export type Label = Digit | 'discarded'
export type Kind = 'printed' | 'handwritten' | 'unsure'
/** `app`: a scan that a player uploaded. `photo`: a photo of `just import-photos`. */
export type Source = 'app' | 'photo'
/** Top left, top right, bottom right, bottom left, in upright photo pixels. */
export type Corners = [[number, number], [number, number], [number, number], [number, number]]

export interface StartCounts {
  outlines: number
  scans: number
  scan_cells: number
  not_prelabelled: number
  digits: number
  kind: number
  /** null until the doubtful labels were computed in this server run. */
  doubtful: number | null
  suspects: boolean
  changes: number
}

export interface OutlineTile {
  photo: string
  source: Source
  /** How well the grid lines follow the outline, higher is better. -1 without an outline. */
  fit: number
  corners: Corners | null
}

export interface OutlinePage {
  scans: OutlineTile[]
  open: number
  page: number
  pages: number
}

export interface Outline {
  photo: string
  source: Source
  status: 'unchecked' | 'accepted' | 'rejected'
  width: number
  height: number
  corners: Corners | null
}

export interface ScanSummary {
  photo: string
  source: Source
  open: number
  edited: number
}

export interface MissingPlace {
  row: number
  col: number
  missing: true
}

export interface ScanCell {
  row: number
  col: number
  id: string
  stem: string
  /** null: an imported cell without a pre-label. */
  digit: Digit | null
  kind: Kind | null
  /** The digit and kind are the model's pre-label, not a label. */
  suggested: boolean
  /** The player changed the label on the phone. */
  edited: boolean
  reviewed: boolean
  /** The stem of the scan that owns the cell, when it is not this scan. */
  shared: string | null
  /** In discarded/: out of the labels of the scan. */
  locked: boolean
}

export interface Scan extends Outline {
  cells: (ScanCell | MissingPlace)[]
}

export interface DigitCell {
  id: string
  stem: string
  /** The model's confidence in the digit, 0 to 1. */
  p: number
}

export interface DigitPage {
  digit: Digit
  kinds: string
  /** The least sure first, at most 100. */
  cells: DigitCell[]
  left: number
  counts: Record<Digit, number>
  not_prelabelled: number
}

export interface KindCell {
  id: string
  stem: string
  kind: Kind | null
  /** The kind that the page starts with: the model's guess or the majority of the group. */
  start: Kind | null
  least_sure: boolean
  kp?: number
  model_kind?: string
}

export interface KindPage {
  folder: string
  group: number
  groups: number
  page: number
  pages: number
  ungrouped: boolean
  predicted: string | null
  cells: KindCell[]
  progress: { cells: number; labelled: number }
}

export interface DoubtReason {
  reason: 'near-duplicate' | 'kind-model' | 'digit-model' | 'check'
  label?: string
  predicted?: string
  p_label?: number
  p_predicted?: number
}

export interface DoubtfulItem {
  id: string
  stem: string
  field: 'digit' | 'kind'
  folder: string
  kind: Kind | null
  reasons: DoubtReason[]
}

export interface DoubtfulPage {
  items: DoubtfulItem[]
  open: number
  /** False until `just suspects` ran. */
  suspects: boolean
}

export interface FetchReport {
  pulled: number
  already_pulled: number
  cells: number
  invalid: string[]
  fixture: string[]
  missing_photo: string[]
  stage: string
  table: string
  bucket: string
}

export interface FixResult {
  cells: number
  kept: number
  discarded: number
}

export interface FinishResult {
  text: string
  removed: string[]
  review_closed: number | null
  still_waiting: { cells: number; photos: number }
}

export interface LabelledCell {
  id: string
  digit: Label
  kind?: Kind | null
}
