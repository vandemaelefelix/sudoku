import { z } from 'zod'

export const SCAN_SCHEMA_VERSION = 1
/** Bytes. The photo limit of ADR-030 decision 8. */
export const MAX_JPEG_BYTES = 1_000_000

/** The header that carries the shared app key. The key is not a secret (SUD-11). */
export const APP_KEY_HEADER = 'x-app-key'
/** The header that carries the photo length in bytes. The route signs it into the upload URL. */
export const JPEG_BYTES_HEADER = 'x-jpeg-bytes'

/** The answer of `POST /v1/scans` (ADR-030). */
export const scanAnswerSchema = z.object({ uploadUrl: z.string() })
export type ScanAnswer = z.infer<typeof scanAnswerSchema>

const GRID_CELLS = 81
const DIGIT_CLASSES = 10
const KIND_CLASSES = 4
const PROBABILITY_SUM_TOLERANCE = 1e-3

const probability = z.number().min(0).max(1)

function sumsToOne(probs: number[]): boolean {
  return Math.abs(probs.reduce((a, b) => a + b, 0) - 1) <= PROBABILITY_SUM_TOLERANCE
}

const scanCellSchema = z.object({
  digitProbs: z.array(probability).length(DIGIT_CLASSES).refine(sumsToOne, 'digitProbs must sum to 1'),
  kindProbs: z.array(probability).length(KIND_CLASSES).refine(sumsToOne, 'kindProbs must sum to 1'),
  finalDigit: z
    .number()
    .int()
    .min(0)
    .max(DIGIT_CLASSES - 1),
  finalKind: z
    .number()
    .int()
    .min(0)
    .max(KIND_CLASSES - 1),
  edited: z.boolean(),
})

const corner = z.tuple([probability, probability])

/** The cross products of consecutive edges all have one sign. Zero means a degenerate quad. */
function isConvexQuad(corners: [number, number][]): boolean {
  let sign = 0
  for (let i = 0; i < corners.length; i++) {
    const [ax, ay] = corners[i]!
    const [bx, by] = corners[(i + 1) % corners.length]!
    const [cx, cy] = corners[(i + 2) % corners.length]!
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx)
    if (Math.abs(cross) < 1e-9) return false
    const s = Math.sign(cross)
    if (sign !== 0 && s !== sign) return false
    sign = s
  }
  return true
}

const scanRecordSchema = z.object({
  schemaVersion: z.literal(SCAN_SCHEMA_VERSION),
  scanId: z.uuid(),
  contributorId: z.uuid(),
  appVersion: z.string().min(1).max(32),
  modelVersion: z.string().min(1).max(32),
  corners: z
    .array(corner)
    .length(4)
    .refine((c) => isConvexQuad(c as [number, number][]), 'corners must form a convex quad'),
  cells: z.array(scanCellSchema).length(GRID_CELLS),
})

export type ScanCell = z.infer<typeof scanCellSchema>
export type ScanRecord = z.infer<typeof scanRecordSchema>

export function validateScanRecord(input: unknown): { ok: true; record: ScanRecord } | { ok: false; reason: string } {
  const parsed = scanRecordSchema.safeParse(input)
  if (parsed.success) return { ok: true, record: parsed.data }
  const issue = parsed.error.issues[0]
  const path = issue?.path.join('.')
  const message = issue?.message ?? 'invalid scan record'
  return { ok: false, reason: path ? `${path}: ${message}` : message }
}
