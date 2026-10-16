import { z } from 'zod'
import { historyEntrySchema } from './historyEntry'
import { MAX_CURSOR_LENGTH, MAX_ENTRIES_PER_SYNC } from './limits'

/** The body of POST /v1/sync. A null cursor asks for a full pull (ADR-028). */
export const syncRequestSchema = z.object({
  entries: z.array(historyEntrySchema).max(MAX_ENTRIES_PER_SYNC),
  cursor: z.string().min(1).max(MAX_CURSOR_LENGTH).nullable(),
})

export type SyncRequest = z.infer<typeof syncRequestSchema>
