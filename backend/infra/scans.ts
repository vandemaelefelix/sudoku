import { API_AUDIENCE, SCANS_ROUTE_KEY } from './backend-settings.ts'
import { announceScansRoute, api } from './api.ts'
import { CLERK_ISSUER, type Stage } from './config.ts'
import { scansBucket } from './scans-bucket.ts'
import { table } from './storage.ts'

// ADR-030. A separate Lambda, so abuse of the public route cannot starve sync (amends ADR-027 decision 5).
// The kill switch finds it by its name prefix `ScansFunction`.
export const scanAppKey = new sst.Secret('ScanAppKey')

export const scansFunction = new sst.aws.Function('ScansFunction', {
  handler: 'backend/api/src/scans/handler.handler',
  link: [table, scansBucket, scanAppKey],
  environment: {
    // The handler verifies the optional token itself, because the route has no authorizer.
    CLERK_ISSUER: CLERK_ISSUER[$app.stage as Stage] ?? '',
    CLERK_AUDIENCE: API_AUDIENCE,
  },
})

// No authorizer: the handler checks the app key header. The throttle is in api.ts (SUD-11). The stage waits for this route.
announceScansRoute(api.route(SCANS_ROUTE_KEY, scansFunction.arn))
