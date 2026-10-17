// No SST globals: `node --test` runs the tests of this file. storage.ts and api.ts read these values.

// The aud claim that the Clerk JWT template sudoku-api adds (ADR-027 decision 1).
export const API_AUDIENCE = 'sudoku-api'

// SUD-11, ADR-027 decision 9. An HTTP API applies this to each route, not to the stage as a whole.
export const STAGE_THROTTLE = { throttlingRateLimit: 1, throttlingBurstLimit: 10 } as const

// SUD-11, ADR-030. The public scans route has no authorizer, so it gets its own, tighter limit.
export const SCANS_ROUTE_KEY = 'POST /v1/scans'
export const SCANS_THROTTLE = { throttlingRateLimit: 0.5, throttlingBurstLimit: 5 } as const

// The SST default format without the IP and the user agent (F-16: no tracking).
// Every value is a string, so a missing context variable cannot break the JSON.
export const ACCESS_LOG_FORMAT = JSON.stringify({
  requestTime: '$context.requestTime',
  requestId: '$context.requestId',
  httpMethod: '$context.httpMethod',
  path: '$context.path',
  routeKey: '$context.routeKey',
  status: '$context.status',
  responseLatency: '$context.responseLatency',
  integrationRequestId: '$context.integration.requestId',
  integrationStatus: '$context.integration.status',
  integrationLatency: '$context.integration.latency',
  integrationServiceStatus: '$context.integration.integrationStatus',
  authorizerError: '$context.authorizer.error',
})

// SST turns point-in-time recovery on for every table. It costs money, and only production holds data to keep.
export function pointInTimeRecovery(stage: string): { enabled: boolean } {
  return { enabled: stage === 'production' }
}

// The JWT authorizer needs an exact issuer. Without one, a deploy stops before it creates the API.
export function clerkIssuerOf(stage: string, issuers: Partial<Record<string, string | null>>): string {
  const issuer = issuers[stage]
  if (!issuer) throw new Error(`Stage ${stage} has no Clerk issuer. Set CLERK_ISSUER in backend/infra/config.ts.`)
  return issuer
}
