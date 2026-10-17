import {
  GetApisCommand,
  GetStageCommand,
  UpdateStageCommand,
  type ApiGatewayV2Client,
  type RouteSettings,
} from '@aws-sdk/client-apigatewayv2'
import {
  DeleteFunctionConcurrencyCommand,
  ListFunctionsCommand,
  PutFunctionConcurrencyCommand,
  type LambdaClient,
} from '@aws-sdk/client-lambda'
import { PublishCommand, type SNSClient } from '@aws-sdk/client-sns'
import { DeleteParameterCommand, PutParameterCommand, type SSMClient } from '@aws-sdk/client-ssm'
import { killSwitchFlagName, type FlagValue } from './flag.ts'
import type { KillSwitchDeps } from './killSwitch.ts'
import type { Throttle, TurnOnDeps } from './turnOn.ts'

export interface AwsClients {
  apigw: Pick<ApiGatewayV2Client, 'send'>
  lambda: Pick<LambdaClient, 'send'>
  ssm: Pick<SSMClient, 'send'>
  sns: Pick<SNSClient, 'send'>
}

// SST names a function `<app>-<stage>-<logical name><hash>`. The kill-switch Lambda has the tags of
// the production stage too, so the name picks the API functions and never the kill switch itself (ADR-030: two functions).
const apiFunctionPrefixes = (stage: string): string[] => [
  `sudoku-${stage}-SyncApiFunction`,
  `sudoku-${stage}-ScansFunction`,
]

// The log and the summary name the failing call and the AWS error. A message alone can be empty.
async function named<T>(call: string, step: () => Promise<T>): Promise<T> {
  try {
    return await step()
  } catch (error) {
    const reason = error instanceof Error ? `${error.name}${error.message ? `: ${error.message}` : ''}` : String(error)
    throw new Error(`${call} failed (${reason})`, { cause: error })
  }
}

export type AwsOps = Omit<KillSwitchDeps, 'now'> & TurnOnDeps

export function createAwsOps(clients: AwsClients, options: { alertTopicArn?: string | undefined } = {}): AwsOps {
  const { apigw, lambda, ssm, sns } = clients

  async function setThrottle(
    apiId: string,
    rate: number,
    burst: number,
    routeThrottles: Record<string, Throttle> = {},
  ): Promise<void> {
    // The `$default` stage of an HTTP API: SST creates no other stage (ADR-027).
    const stageName = '$default'
    const stage = await named('GetStage', () => apigw.send(new GetStageCommand({ ApiId: apiId, StageName: stageName })))
    const apply = (settings: RouteSettings | undefined, limit?: Throttle): RouteSettings => ({
      ...settings,
      ThrottlingRateLimit: limit?.throttlingRateLimit ?? rate,
      ThrottlingBurstLimit: limit?.throttlingBurstLimit ?? burst,
    })
    // A route with its own limit goes in the map even when the stage lost its entry.
    const keys = new Set([...Object.keys(stage.RouteSettings ?? {}), ...Object.keys(routeThrottles)])
    const routes = Object.fromEntries(
      [...keys].map((key) => [key, apply(stage.RouteSettings?.[key], routeThrottles[key])]),
    )
    // API Gateway answers BadRequestException to an empty RouteSettings map, so send the map only with routes.
    await named('UpdateStage', () =>
      apigw.send(
        new UpdateStageCommand({
          ApiId: apiId,
          StageName: stageName,
          DefaultRouteSettings: apply(stage.DefaultRouteSettings),
          ...(Object.keys(routes).length > 0 ? { RouteSettings: routes } : {}),
        }),
      ),
    )
  }

  return {
    async findApis(stage) {
      const ids: string[] = []
      let token: string | undefined
      do {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Each page needs the token of the page before it.
        const page = await named('GetApis', () => apigw.send(new GetApisCommand({ NextToken: token })))
        for (const api of page.Items ?? []) {
          if (api.ApiId && api.Tags?.project === 'sudoku' && api.Tags.stage === stage) ids.push(api.ApiId)
        }
        token = page.NextToken
      } while (token)
      return ids
    },
    async findFunctions(stage) {
      const names: string[] = []
      let marker: string | undefined
      do {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Each page needs the marker of the page before it.
        const page = await lambda.send(new ListFunctionsCommand({ Marker: marker }))
        for (const fn of page.Functions ?? []) {
          const name = fn.FunctionName
          if (name && apiFunctionPrefixes(stage).some((prefix) => name.startsWith(prefix))) names.push(name)
        }
        marker = page.NextMarker
      } while (marker)
      return names
    },
    stopApi: (apiId) => setThrottle(apiId, 0, 0),
    startApi: (apiId, throttle: Throttle, routeThrottles) =>
      setThrottle(apiId, throttle.throttlingRateLimit, throttle.throttlingBurstLimit, routeThrottles),
    async stopFunction(name) {
      await lambda.send(new PutFunctionConcurrencyCommand({ FunctionName: name, ReservedConcurrentExecutions: 0 }))
    },
    async startFunction(name) {
      await lambda.send(new DeleteFunctionConcurrencyCommand({ FunctionName: name }))
    },
    async setFlag(stage: string, value: FlagValue) {
      await ssm.send(
        new PutParameterCommand({
          Name: killSwitchFlagName(stage),
          Type: 'String',
          Tier: 'Standard',
          Overwrite: true,
          Value: JSON.stringify(value),
        }),
      )
    },
    async clearFlag(stage) {
      try {
        await ssm.send(new DeleteParameterCommand({ Name: killSwitchFlagName(stage) }))
      } catch (error) {
        if (!(error instanceof Error) || error.name !== 'ParameterNotFound') throw error
      }
    },
    async notify(subject, body) {
      if (!options.alertTopicArn) throw new Error('No alert topic is set.')
      await sns.send(new PublishCommand({ TopicArn: options.alertTopicArn, Subject: subject, Message: body }))
    },
  }
}
