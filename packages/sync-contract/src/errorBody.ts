import { z } from 'zod'
import { MAX_ERROR_MESSAGE_LENGTH } from './limits'

// invalid_request is a 400, daily_limit a 429, internal_error a 500.
// API Gateway sends its own body for a 401 and for a throttle 429, so the app reads the status code first.
export const errorCodeSchema = z.enum(['invalid_request', 'daily_limit', 'internal_error'])

/** The body of an error from the sync Lambda. The message never repeats the request or personal data. */
export const errorBodySchema = z.object({
  code: errorCodeSchema,
  message: z.string().min(1).max(MAX_ERROR_MESSAGE_LENGTH),
})

export type ErrorCode = z.infer<typeof errorCodeSchema>
export type ErrorBody = z.infer<typeof errorBodySchema>
