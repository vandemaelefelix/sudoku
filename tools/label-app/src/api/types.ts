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
  /** Open cells for the Digits step: cells of approved scans and loose cells. */
  digit_cells: number
  /** Open cells for the Kind step: a person confirmed the digit, the kind waits. */
  kind_cells: number
  /** Open cells without probabilities of the current model run. */
  not_prelabelled: number
  /** The run of the guesses, or null when no model guessed yet. */
  model: string | null
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

/** `loose`: a cell in `unlabeled/` that no accepted scan holds. */
export type CheckSource = Source | 'loose'

/** Why a cell is doubtful. Every signal has its own evidence. */
export type Signal =
  | { signal: 'low-p'; p: number }
  | { signal: 'model-differs'; predicted: string; p: number }
  | { signal: 'edited' }
  | { signal: 'rule-break'; unit: 'row' | 'col' | 'box'; index: number }
  | { signal: 'not-unique' }
  | { signal: 'no-guess' }

/** The order of `CellProbs.kind`. */
export const KIND_PROB_NAMES = ['none', 'printed', 'handwritten', 'notes'] as const

export interface CellProbs {
  /** In the order of DIGITS. */
  digit: number[]
  kind: number[]
}

/** An open cell of the Digits step or the Kind step. */
export interface CheckCell {
  id: string
  stem: string
  photo: string | null
  source: CheckSource
  /** The place in the 9 × 9 grid, 0 to 8. null for a loose cell. */
  row: number | null
  col: number | null
  /** The label it starts with. null: no label and no guess. */
  digit: Digit | null
  kind: Kind | null
  /** The player changed the label on the phone. */
  edited: boolean
  probs: CellProbs | null
  /** 0 sure to 1 doubtful: the colour of the tile edge. */
  doubt: number
  reasons: Signal[]
}

/** The answer of `/api/check/digits` and `/api/check/kinds`. A tab is `empty`, `1` to `9`, or `unknown` (Digits only). */
interface CheckPageBase {
  digit: string
  /** At most 240, the highest doubt first. */
  cells: CheckCell[]
  left: number
  counts: Record<string, number>
  /** The cells of each tab that a person confirmed in this journal. */
  done: Record<string, number>
  /** The cells of this tab that the sure button confirms at this threshold. */
  sure: number
  threshold: number
}

export type DigitPage = CheckPageBase

export interface KindPage extends CheckPageBase {
  /** The open cells of the digit per kind label, whatever kind is shown. */
  kind_counts: Record<KindTab, number>
}

export type CheckPage = DigitPage | KindPage

export const isKindPage = (page: CheckPage): page is KindPage => 'kind_counts' in page

/** A kind tab of the Kind step. `all` shows every kind. */
export type KindTab = 'all' | Kind

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
  /** The data check report as data. The app shows `text`. */
  report: unknown
  text: string
  removed: string[]
  review_closed: number | null
  still_waiting: { cells: number; photos: number }
}
