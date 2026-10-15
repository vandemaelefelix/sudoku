import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda'
import type { SyncDeps } from './deps'
import { notFound, serverError, type Response } from './http'
import type { LogFields } from './log'
import { sync } from './sync'

// One Lambda for every route (ADR-027 decision 5). API Gateway refuses an unknown route first, so 404 is a guard.
export async function route(deps: SyncDeps, event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<Response> {
  const started = performance.now()
  const fields: LogFields = { requestId: event.requestContext.requestId, routeKey: event.requestContext.routeKey }
  let response: Response
  try {
    response = event.requestContext.routeKey === 'POST /v1/sync' ? await sync(deps, event, fields) : notFound()
  } catch (error) {
    // Only the name: a DynamoDB message can hold a key, and the identity key holds the sub.
    fields.errorName = error instanceof Error ? error.name : 'Unknown'
    response = serverError()
  }
  deps.log({ ...fields, status: response.statusCode, durationMs: Math.round(performance.now() - started) })
  return response
}
