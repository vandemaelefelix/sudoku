import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda'
import type { SyncDeps } from './deps'
import { notFound, observe, type Response } from './http'
import type { LogFields } from './log'
import { deleteAccount } from './account'
import { sync } from './sync'

// One Lambda for every route (ADR-027 decision 5). API Gateway refuses an unknown route first, so 404 is a guard.
export function route(deps: SyncDeps, event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<Response> {
  return observe(deps.log, event, (fields) => dispatch(deps, event, fields))
}

function dispatch(
  deps: SyncDeps,
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  fields: LogFields,
): Promise<Response> | Response {
  switch (event.requestContext.routeKey) {
    case 'POST /v1/sync':
      return sync(deps, event, fields)
    case 'DELETE /v1/account':
      return deleteAccount(deps, event, fields)
    default:
      return notFound()
  }
}
