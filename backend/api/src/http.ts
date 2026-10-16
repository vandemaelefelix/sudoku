import type { ErrorCode } from '@sudoku/sync-contract'
import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda'

export type Response = APIGatewayProxyStructuredResultV2 & { statusCode: number }

const STATUS: Record<ErrorCode, number> = { invalid_request: 400, invalid_cursor: 400, account_deleted: 410 }

// Fixed texts: a message never repeats the request or personal data (the sync contract).
const MESSAGE: Record<ErrorCode, string> = {
  invalid_request: 'The request does not match the sync contract.',
  invalid_cursor: 'The server cannot use the cursor. Clear it and make a full pull.',
  account_deleted: 'The account was deleted.',
}

export function json(statusCode: number, body: unknown): Response {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}

export function errorResponse(code: ErrorCode): Response {
  return json(STATUS[code], { code, message: MESSAGE[code] })
}

// The same bodies as API Gateway, so the app reads only the status code for these (ADR-028 decision 8).
export const unauthorized = (): Response => json(401, { message: 'Unauthorized' })
export const notFound = (): Response => json(404, { message: 'Not Found' })
export const serverError = (): Response => json(500, { message: 'Internal Server Error' })
