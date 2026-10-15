import { ACCESS_LOG_FORMAT, API_AUDIENCE, STAGE_THROTTLE, clerkIssuerOf } from './backend-settings.ts'
import { clerkSecretKey } from './clerk.ts'
import { CLERK_ISSUER } from './config.ts'
import { table } from './storage.ts'

// Throws before any API resource exists, so a stage without Clerk never gets an API without a token check.
const issuer = clerkIssuerOf($app.stage, CLERK_ISSUER)

// One Lambda for every route (ADR-027 decision 5). The kill switch sets the concurrency of this function.
export const syncFunction = new sst.aws.Function('SyncApiFunction', {
  handler: 'services/sync-api/src/handler.handler',
  link: [table, ...(clerkSecretKey ? [clerkSecretKey] : [])],
  // The delete route deletes every row of a player in pages. A sync needs under 1 s (ADR-027 amendment, delete the account).
  timeout: '30 seconds',
})

export const api = new sst.aws.ApiGatewayV2('SyncApi', {
  // Only the native app calls the API. SST turns CORS on by default.
  cors: false,
  transform: {
    stage: (args) => {
      args.defaultRouteSettings = STAGE_THROTTLE
      args.accessLogSettings = $output(args.accessLogSettings).apply((settings) => {
        if (!settings) throw new Error('SST created no access log for the stage. Check the SST version.')
        return { destinationArn: settings.destinationArn, format: ACCESS_LOG_FORMAT }
      })
    },
  },
})

const clerk = api.addAuthorizer({ name: 'clerk', jwt: { issuer, audiences: [API_AUDIENCE] } })

api.route('POST /v1/sync', syncFunction.arn, { auth: { jwt: { authorizer: clerk.id } } })
api.route('DELETE /v1/account', syncFunction.arn, { auth: { jwt: { authorizer: clerk.id } } })
