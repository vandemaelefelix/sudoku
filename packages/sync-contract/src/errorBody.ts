import { z } from 'zod'
import { MAX_ERROR_MESSAGE_LENGTH } from './limits'

// invalid_request and invalid_cursor are a 400, account_deleted a 410 (ADR-028, decision 8).
// API Gateway sends its own body for a 401 and a 429, so the app reads the status code first.
export const errorCodeSchema = z.enum(['invalid_request', 'invalid_cursor', 'account_deleted'])

/** The body of an error from the sync Lambda. The message never repeats the request or personal data. */
export const errorBodySchema = z.object({
  code: errorCodeSchema,
  message: z.string().min(1).max(MAX_ERROR_MESSAGE_LENGTH),
})

export type ErrorCode = z.infer<typeof errorCodeSchema>
export type ErrorBody = z.infer<typeof errorBodySchema>
