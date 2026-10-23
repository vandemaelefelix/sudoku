import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda'
import { describe, expect, it } from 'vitest'
import { InvalidCursor } from '../../src/cursor'
import { Refusal, json, observe, parseJsonBody, refuse, subOf } from '../../src/http'
import { AccountDeleted } from '../../src/identity'
import type { LogFields } from '../../src/log'

const event = { requestContext: { requestId: 'req-1', routeKey: 'POST /v1/sync' } }

const withSub = (sub: unknown) =>
  ({
    requestContext: { authorizer: { jwt: { claims: { sub } } } },
  }) as unknown as APIGatewayProxyEventV2WithJWTAuthorizer

async function run(step: (fields: LogFields) => ReturnType<typeof json>) {
  const lines: LogFields[] = []
  const response = await observe(
    (fields) => lines.push(fields),
    event,
    async (fields) => step(fields),
  )
  return { response, line: lines[0] }
}

describe('observe', () => {
  it('logs the status of a normal response', async () => {
    const { response, line } = await run(() => json(200, {}))
    expect(response.statusCode).toBe(200)
    expect(line).toMatchObject({ requestId: 'req-1', routeKey: 'POST /v1/sync', status: 200 })
  })

  it('turns a Refusal into its error body and logs the code', async () => {
    const { response, line } = await run(() => refuse('invalid_cursor'))
    expect(response.statusCode).toBe(400)
    expect(JSON.parse(String(response.body)).code).toBe('invalid_cursor')
    expect(line).toMatchObject({ status: 400, code: 'invalid_cursor' })
    expect(line?.errorName).toBeUndefined()
  })

  it('treats the typed errors as refusals', () => {
    expect(new InvalidCursor()).toBeInstanceOf(Refusal)
    expect(new AccountDeleted().code).toBe('account_deleted')
  })

  it('answers 500 and logs only the error name for any other error', async () => {
    const { response, line } = await run(() => {
      throw new TypeError('secret key detail')
    })
    expect(response.statusCode).toBe(500)
    expect(line).toMatchObject({ status: 500, errorName: 'TypeError' })
    expect(JSON.stringify(line)).not.toContain('secret')
  })
})

describe('parseJsonBody', () => {
  it('reads a plain and a base64 body', () => {
    expect(parseJsonBody({ body: '{"a":1}', isBase64Encoded: false })).toEqual({ a: 1 })
    expect(parseJsonBody({ body: Buffer.from('{"a":2}').toString('base64'), isBase64Encoded: true })).toEqual({ a: 2 })
  })

  it('refuses a missing body and a body that is not JSON', () => {
    expect(() => parseJsonBody({ isBase64Encoded: false })).toThrow(Refusal)
    expect(() => parseJsonBody({ body: '{no', isBase64Encoded: false })).toThrow(Refusal)
  })
})

describe('subOf', () => {
  it('returns a non-empty string sub only', () => {
    expect(subOf(withSub('user_1'))).toBe('user_1')
    expect(subOf(withSub(''))).toBeUndefined()
    expect(subOf(withSub(42))).toBeUndefined()
  })
})
