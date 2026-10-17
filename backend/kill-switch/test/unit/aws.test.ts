import { describe, expect, it, vi } from 'vitest'
import { GetApisCommand, GetStageCommand, UpdateStageCommand } from '@aws-sdk/client-apigatewayv2'
import {
  DeleteFunctionConcurrencyCommand,
  ListFunctionsCommand,
  PutFunctionConcurrencyCommand,
} from '@aws-sdk/client-lambda'
import { DeleteParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm'
import { PublishCommand } from '@aws-sdk/client-sns'
import { createAwsOps } from '../../src/aws.ts'

type Handler = (input: any) => unknown
function client(handlers: Record<string, Handler>) {
  const send = vi.fn<(command: { constructor: { name: string }; input: unknown }) => Promise<unknown>>(
    async (command) => {
      const handler = handlers[command.constructor.name]
      if (!handler) throw new Error(`unexpected ${command.constructor.name}`)
      return handler(command.input)
    },
  )
  return { send } as unknown as { send: typeof send }
}
const sent = (c: { send: ReturnType<typeof vi.fn> }, type: new (...a: any[]) => unknown) =>
  c.send.mock.calls.map((x) => x[0]).filter((x) => x instanceof type) as { input: any }[]

function ops(parts: Partial<Record<'apigw' | 'lambda' | 'ssm' | 'sns', ReturnType<typeof client>>> = {}) {
  const clients = {
    apigw: client({}),
    lambda: client({}),
    ssm: client({}),
    sns: client({}),
    ...parts,
  }
  return { ops: createAwsOps(clients as never, { alertTopicArn: 'arn:topic' }), clients }
}

describe('findApis', () => {
  it('pages through the APIs and keeps those tagged for the stage', async () => {
    const apigw = client({
      GetApisCommand: (input) =>
        input.NextToken
          ? { Items: [{ ApiId: 'c', Tags: { project: 'sudoku', stage: 'felix' } }] }
          : {
              Items: [
                { ApiId: 'a', Tags: { project: 'sudoku', stage: 'felix' } },
                { ApiId: 'b', Tags: { project: 'sudoku', stage: 'dev' } },
                { ApiId: 'x', Tags: { project: 'other', stage: 'felix' } },
                { ApiId: 'y' },
              ],
              NextToken: 'next',
            },
    })
    const { ops: o } = ops({ apigw })
    expect(await o.findApis('felix')).toEqual(['a', 'c'])
    expect(sent(apigw, GetApisCommand)).toHaveLength(2)
  })
})

describe('findFunctions', () => {
  it('returns only the sync-api function of the stage, never the kill switch itself', async () => {
    const lambda = client({
      ListFunctionsCommand: () => ({
        Functions: [
          { FunctionName: 'sudoku-felix-SyncApiFunctionAbc' },
          { FunctionName: 'sudoku-felix-ScansFunctionXyz' },
          { FunctionName: 'sudoku-production-SyncApiFunctionDef' },
          { FunctionName: 'sudoku-production-KillSwitchSubscriberXyz' },
        ],
      }),
    })
    const { ops: o } = ops({ lambda })
    expect(await o.findFunctions('felix')).toEqual(['sudoku-felix-SyncApiFunctionAbc', 'sudoku-felix-ScansFunctionXyz'])
    expect(await o.findFunctions('production')).toEqual(['sudoku-production-SyncApiFunctionDef'])
    expect(sent(lambda, ListFunctionsCommand).length).toBeGreaterThan(0)
  })
})

describe('stopApi', () => {
  it('sets the default and every explicit route to rate 0 and burst 0, and keeps other settings', async () => {
    const apigw = client({
      GetStageCommand: () => ({
        DefaultRouteSettings: { ThrottlingRateLimit: 1, ThrottlingBurstLimit: 10, DetailedMetricsEnabled: false },
        RouteSettings: { 'POST /v1/sync': { ThrottlingRateLimit: 5, ThrottlingBurstLimit: 5, LoggingLevel: 'OFF' } },
      }),
      UpdateStageCommand: () => ({}),
    })
    const { ops: o } = ops({ apigw })
    await o.stopApi('api-1')
    expect(sent(apigw, GetStageCommand)[0]!.input).toEqual({ ApiId: 'api-1', StageName: '$default' })
    const update = sent(apigw, UpdateStageCommand)[0]!.input
    expect(update.StageName).toBe('$default')
    expect(update.DefaultRouteSettings).toEqual({
      ThrottlingRateLimit: 0,
      ThrottlingBurstLimit: 0,
      DetailedMetricsEnabled: false,
    })
    expect(update.RouteSettings['POST /v1/sync']).toEqual({
      ThrottlingRateLimit: 0,
      ThrottlingBurstLimit: 0,
      LoggingLevel: 'OFF',
    })
  })
})

describe('a stage without explicit routes', () => {
  it('sends no RouteSettings, because API Gateway rejects an empty map', async () => {
    const apigw = client({
      GetStageCommand: () => ({
        DefaultRouteSettings: { ThrottlingRateLimit: 1, ThrottlingBurstLimit: 10 },
        RouteSettings: {},
      }),
      UpdateStageCommand: () => ({}),
    })
    await ops({ apigw }).ops.stopApi('api-1')
    const update = sent(apigw, UpdateStageCommand)[0]!.input
    expect('RouteSettings' in update).toBe(false)
    expect(update.DefaultRouteSettings).toMatchObject({ ThrottlingRateLimit: 0, ThrottlingBurstLimit: 0 })
  })

  it('names the failing call and the AWS error', async () => {
    const apigw = client({
      GetStageCommand: () => ({}),
      UpdateStageCommand: () => {
        throw Object.assign(new Error(''), { name: 'BadRequestException' })
      },
    })
    await expect(ops({ apigw }).ops.stopApi('api-1')).rejects.toThrow('UpdateStage failed (BadRequestException)')
  })
})

describe('startApi', () => {
  it('restores a stage that is stopped on the default only', async () => {
    const apigw = client({
      GetStageCommand: () => ({
        DefaultRouteSettings: { ThrottlingRateLimit: 0, ThrottlingBurstLimit: 0 },
        RouteSettings: {},
      }),
      UpdateStageCommand: () => ({}),
    })
    await ops({ apigw }).ops.startApi('api-1', { throttlingRateLimit: 1, throttlingBurstLimit: 10 })
    expect(sent(apigw, UpdateStageCommand)[0]!.input.DefaultRouteSettings).toMatchObject({
      ThrottlingRateLimit: 1,
      ThrottlingBurstLimit: 10,
    })
  })

  it('restores the given throttle on the default and on every explicit route', async () => {
    const apigw = client({
      GetStageCommand: () => ({
        DefaultRouteSettings: { ThrottlingRateLimit: 0, ThrottlingBurstLimit: 0 },
        RouteSettings: { 'POST /v1/sync': { ThrottlingRateLimit: 0, ThrottlingBurstLimit: 0 } },
      }),
      UpdateStageCommand: () => ({}),
    })
    const { ops: o } = ops({ apigw })
    await o.startApi('api-1', { throttlingRateLimit: 1, throttlingBurstLimit: 10 })
    const update = sent(apigw, UpdateStageCommand)[0]!.input
    expect(update.DefaultRouteSettings).toMatchObject({ ThrottlingRateLimit: 1, ThrottlingBurstLimit: 10 })
    expect(update.RouteSettings['POST /v1/sync']).toMatchObject({ ThrottlingRateLimit: 1, ThrottlingBurstLimit: 10 })
  })
})

describe('startApi with route overrides', () => {
  it('keeps the tighter throttle of an overridden route, also when the route is not in the stage yet', async () => {
    const apigw = client({
      GetStageCommand: () => ({
        DefaultRouteSettings: { ThrottlingRateLimit: 0, ThrottlingBurstLimit: 0 },
        RouteSettings: {
          'POST /v1/sync': { ThrottlingRateLimit: 0, ThrottlingBurstLimit: 0 },
          'POST /v1/scans': { ThrottlingRateLimit: 0, ThrottlingBurstLimit: 0 },
        },
      }),
      UpdateStageCommand: () => ({}),
    })
    const scans = { throttlingRateLimit: 0.5, throttlingBurstLimit: 5 }
    await ops({ apigw }).ops.startApi(
      'api-1',
      { throttlingRateLimit: 1, throttlingBurstLimit: 10 },
      {
        'POST /v1/scans': scans,
      },
    )
    const update = sent(apigw, UpdateStageCommand)[0]!.input
    expect(update.RouteSettings['POST /v1/sync']).toMatchObject({ ThrottlingRateLimit: 1, ThrottlingBurstLimit: 10 })
    expect(update.RouteSettings['POST /v1/scans']).toMatchObject({ ThrottlingRateLimit: 0.5, ThrottlingBurstLimit: 5 })
  })
})

describe('functions', () => {
  it('stopFunction reserves 0 concurrency', async () => {
    const lambda = client({ PutFunctionConcurrencyCommand: () => ({}) })
    await ops({ lambda }).ops.stopFunction('fn')
    expect(sent(lambda, PutFunctionConcurrencyCommand)[0]!.input).toEqual({
      FunctionName: 'fn',
      ReservedConcurrentExecutions: 0,
    })
  })

  it('startFunction deletes the reservation', async () => {
    const lambda = client({ DeleteFunctionConcurrencyCommand: () => ({}) })
    await ops({ lambda }).ops.startFunction('fn')
    expect(sent(lambda, DeleteFunctionConcurrencyCommand)[0]!.input).toEqual({ FunctionName: 'fn' })
  })
})

describe('the flag', () => {
  it('setFlag writes the JSON to /sudoku/kill-switch/<stage> and overwrites', async () => {
    const ssm = client({ PutParameterCommand: () => ({}) })
    await ops({ ssm }).ops.setFlag('felix', { at: 'now', reason: 'budget' })
    expect(sent(ssm, PutParameterCommand)[0]!.input).toEqual({
      Name: '/sudoku/kill-switch/felix',
      Type: 'String',
      Tier: 'Standard',
      Overwrite: true,
      Value: '{"at":"now","reason":"budget"}',
    })
  })

  it('clearFlag deletes it and accepts a missing flag', async () => {
    const ssm = client({
      DeleteParameterCommand: () => {
        const error = new Error('gone')
        error.name = 'ParameterNotFound'
        throw error
      },
    })
    await ops({ ssm }).ops.clearFlag('felix')
    expect(sent(ssm, DeleteParameterCommand)[0]!.input).toEqual({ Name: '/sudoku/kill-switch/felix' })
  })

  it('clearFlag rethrows any other error', async () => {
    const ssm = client({
      DeleteParameterCommand: () => {
        throw new Error('denied')
      },
    })
    await expect(ops({ ssm }).ops.clearFlag('felix')).rejects.toThrow('denied')
  })
})

describe('notify', () => {
  it('publishes to the alert topic', async () => {
    const sns = client({ PublishCommand: () => ({}) })
    await ops({ sns }).ops.notify('subject', 'body')
    expect(sent(sns, PublishCommand)[0]!.input).toEqual({ TopicArn: 'arn:topic', Subject: 'subject', Message: 'body' })
  })
})
