import type { ErrorCode } from '@sudoku/sync-contract'
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda'
import type { LogFields, Logger } from './log'

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

// A step throws this to stop the request with an error body. observe() catches it once, so a handler reads straight.
export class Refusal extends Error {
  override name = 'Refusal'
  constructor(readonly code: ErrorCode) {
    super(code)
  }
}

export function refuse(code: ErrorCode): never {
  throw new Refusal(code)
}

// ADR-027 decision 4: the player comes only from the token, never from the path or the body.
export function subOf(event: APIGatewayProxyEventV2WithJWTAuthorizer): string | undefined {
  const sub = event.requestContext.authorizer?.jwt?.claims?.sub
  return typeof sub === 'string' && sub !== '' ? sub : undefined
}

// Refuses with invalid_request for a body that is missing or is not JSON.
export function parseJsonBody(event: Pick<APIGatewayProxyEventV2, 'body' | 'isBase64Encoded'>): unknown {
  const text = event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString('utf8') : (event.body ?? '')
  try {
    return JSON.parse(text)
  } catch {
    return refuse('invalid_request')
  }
}

// Logs one line per request and turns an error into a response. `run` writes the counts for the log line into `fields`.
export async function observe(
  log: Logger,
  event: { requestContext: Pick<APIGatewayProxyEventV2['requestContext'], 'requestId' | 'routeKey'> },
  run: (fields: LogFields) => Promise<Response> | Response,
): Promise<Response> {
  const started = performance.now()
  const fields: LogFields = { requestId: event.requestContext.requestId, routeKey: event.requestContext.routeKey }
  let response: Response
  try {
    response = await run(fields)
  } catch (error) {
    if (error instanceof Refusal) {
      fields.code = error.code
      response = errorResponse(error.code)
    } else {
      // Only the name: a DynamoDB message can hold a key, and the identity key holds the sub.
      fields.errorName = error instanceof Error ? error.name : 'Unknown'
      response = serverError()
    }
  }
  log({ ...fields, status: response.statusCode, durationMs: Math.round(performance.now() - started) })
  return response
}
