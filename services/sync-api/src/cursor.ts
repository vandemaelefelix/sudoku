import { z } from 'zod'
import { GAME_PREFIX } from './tableDesign'

// The form that the server stamps with Date.toISOString(), so a string compare orders it.
const utcTime = z.iso.datetime({ precision: 3 })

// The LastEvaluatedKey of a bySynced query: the table key plus the index key.
const afterSchema = z.strictObject({ pk: z.string(), sk: z.string().startsWith(GAME_PREFIX), syncedAt: utcTime })

// Only the server reads the cursor. The app stores the string (ADR-028 decision 6).
export const cursorSchema = z.strictObject({
  v: z.literal(1),
  since: utcTime.nullable(),
  after: afterSchema.nullable(),
})

export type Cursor = z.infer<typeof cursorSchema>
export type After = z.infer<typeof afterSchema>

export class InvalidCursor extends Error {
  override name = 'InvalidCursor'
}

const BASE64URL = /^[A-Za-z0-9_-]+$/

export const FULL_PULL: Cursor = { v: 1, since: null, after: null }

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

// Throws InvalidCursor for every form that encodeCursor cannot produce. A null cursor asks for a full pull.
export function decodeCursor(encoded: string | null): Cursor {
  if (encoded === null) return FULL_PULL
  if (!BASE64URL.test(encoded)) throw new InvalidCursor()
  let json: unknown
  try {
    json = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  } catch {
    throw new InvalidCursor()
  }
  const parsed = cursorSchema.safeParse(json)
  if (!parsed.success) throw new InvalidCursor()
  return parsed.data
}

// The end-of-read rule of ADR-028 decision 6. A pure function of the request cursor and the query result.
export function nextCursor(
  request: Cursor,
  rows: readonly { syncedAt: string }[],
  lastEvaluatedKey: Record<string, unknown> | undefined,
): { cursor: Cursor; more: boolean } {
  if (lastEvaluatedKey) {
    return { cursor: { v: 1, since: request.since, after: afterSchema.parse(lastEvaluatedKey) }, more: true }
  }
  const lastRow = rows.at(-1)
  // A page that stops at exactly the limit returns a key with no row after it. The next call then reads no rows,
  // and without the after of the request, since would fall back and the next sync would read the range again.
  const since = lastRow?.syncedAt ?? request.after?.syncedAt ?? request.since
  return { cursor: { v: 1, since, after: null }, more: false }
}
