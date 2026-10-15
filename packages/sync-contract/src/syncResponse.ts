import { z } from 'zod'
import { historyEntrySchema } from './historyEntry'
import { MAX_CHANGES_PER_SYNC, MAX_CURSOR_LENGTH, MAX_ENTRIES_PER_SYNC } from './limits'

/** The body of a 200 from POST /v1/sync. With more: true, the next cursor holds more changes (ADR-028). */
export const syncResponseSchema = z.object({
  acceptedIds: z.array(z.uuid()).max(MAX_ENTRIES_PER_SYNC),
  changes: z.array(historyEntrySchema).max(MAX_CHANGES_PER_SYNC),
  cursor: z.string().min(1).max(MAX_CURSOR_LENGTH).nullable(),
  more: z.boolean(),
})

export type SyncResponse = z.infer<typeof syncResponseSchema>
