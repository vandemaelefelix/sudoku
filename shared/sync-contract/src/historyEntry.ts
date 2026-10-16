import { z } from 'zod'
import { HISTORY_ENTRY_VERSION, MAX_SEED } from './limits'

// The same values as the history table of the app (ADR-023).
export const levelSchema = z.enum(['easy', 'medium', 'hard', 'expert'])
export const puzzleSourceSchema = z.enum(['generated', 'scanned'])
export const gameResultSchema = z.enum(['won', 'lost', 'abandoned'])

// Only the form of Date.toISOString(). The server compares updatedAt as a string in a DynamoDB condition (ADR-028).
const utcTime = z.iso.datetime({ precision: 3 })
const count = z.int().min(0)

/** One finished game on the wire. The server keeps syncedAt to itself (ADR-028). */
export const historyEntrySchema = z.object({
  schemaVersion: z.literal(HISTORY_ENTRY_VERSION),
  id: z.uuid(),
  level: levelSchema,
  source: puzzleSourceSchema,
  result: gameResultSchema,
  seed: z.int().min(0).max(MAX_SEED).nullable(),
  playedMs: count,
  mistakes: count,
  hintsUsed: count,
  finishedAt: utcTime,
  createdAt: utcTime,
  updatedAt: utcTime,
  deletedAt: utcTime.nullable(),
})

export type Level = z.infer<typeof levelSchema>
export type PuzzleSource = z.infer<typeof puzzleSourceSchema>
export type GameResult = z.infer<typeof gameResultSchema>
export type HistoryEntry = z.infer<typeof historyEntrySchema>
