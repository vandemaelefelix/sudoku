import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { LogFields } from '../../src/log'
import { handleScan, type ScanDeps } from '../../src/scans/scan'
import { identityKey } from '../../src/tableDesign'
import { getItem, makeDeps, queryPartition, suiteTable } from './harness'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

const NOW = new Date('2026-10-16T09:00:00.000Z')
const KEY = 'app-key-1'
const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`../../../../shared/fixtures/scan-records/${name}.json`, import.meta.url), 'utf8'))

const JPEG = { 'x-jpeg-bytes': '123456' }

function event(body: unknown, headers: Record<string, string> = { 'x-app-key': KEY, ...JPEG }): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /v1/scans',
    rawPath: '/v1/scans',
    rawQueryString: '',
    headers,
    requestContext: { requestId: 'req-1', routeKey: 'POST /v1/scans' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2
}

describe('POST /v1/scans', () => {
  const table = suiteTable()
  let logged: LogFields[]
  let n = 0
  let presigned: string[]
  const deps = (): ScanDeps => ({
    ...makeDeps(table, { now: () => NOW, newUserId: () => `user-${++n}`, log: (fields) => logged.push(fields) }),
    appKey: KEY,
    verifyToken: async (token) => {
      if (token === 'good') return 'user_clerk_1'
      throw new Error('bad token')
    },
    presignPut: async (key, bytes) => {
      presigned.push(`${key}:${bytes}`)
      return `https://bucket.test/${key}?sig=${presigned.length}`
    },
  })
  const row = (pk: string, sk: string) => getItem(table, { pk, sk })

  // The fixtures share one contributorId, so a query on the pk alone also counts the rows of the other tests.
  const scanRows = (pk: string, sk: string) => queryPartition(table, pk, { sk })

  const reset = () => {
    logged = []
    presigned = []
  }

  it('answers 401 for a missing or wrong app key', async () => {
    reset()
    const good = fixture('good-1')
    expect((await handleScan(deps(), event(good, JPEG))).statusCode).toBe(401)
    expect((await handleScan(deps(), event(good, { 'x-app-key': 'nope', ...JPEG }))).statusCode).toBe(401)
    expect(presigned).toEqual([])
  })

  it.each([undefined, '0', '-5', '1.5', 'abc', '1000001', '99999999999'])(
    'answers 400 and writes nothing for the photo length %s',
    async (length) => {
      reset()
      const record: Record<string, unknown> = { ...fixture('good-1'), scanId: '22222222-2222-4222-8222-222222222222' }
      const headers: Record<string, string> = { 'x-app-key': KEY }
      if (length !== undefined) headers['x-jpeg-bytes'] = length
      expect((await handleScan(deps(), event(record, headers))).statusCode).toBe(400)
      expect(presigned).toEqual([])
      expect(await row(`CONTRIB#${record.contributorId}`, `SCAN#${record.scanId}`)).toBeUndefined()
    },
  )

  it('accepts the largest photo length', async () => {
    reset()
    const record: Record<string, unknown> = { ...fixture('good-1'), scanId: '33333333-3333-4333-8333-333333333333' }
    const response = await handleScan(deps(), event(record, { 'x-app-key': KEY, 'x-jpeg-bytes': '1000000' }))
    expect(response.statusCode).toBe(200)
    expect(presigned).toEqual([`scans/${record.scanId}.jpg:1000000`])
  })

  it('answers 400 for a body that is not JSON or breaks the contract', async () => {
    reset()
    expect((await handleScan(deps(), event('{not json'))).statusCode).toBe(400)
    const names = ['bad-cell-count', 'bad-corners-not-convex', 'bad-probability-sum', 'bad-schema-version']
    const codes = await Promise.all(
      names.map(async (name) => (await handleScan(deps(), event(fixture(name)))).statusCode),
    )
    expect(codes).toEqual([400, 400, 400, 400])
    expect(presigned).toEqual([])
  })

  it('stores a CONTRIB row and returns the upload URL for a signed-out player', async () => {
    reset()
    const record = fixture('good-1')
    const response = await handleScan(deps(), event(record))
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body ?? '')).toEqual({
      uploadUrl: `https://bucket.test/scans/${record.scanId}.jpg?sig=1`,
    })
    expect(presigned).toEqual([`scans/${record.scanId}.jpg:123456`])
    const item = await row(`CONTRIB#${record.contributorId}`, `SCAN#${record.scanId}`)
    expect(item).toMatchObject({
      scanId: record.scanId,
      contributorId: record.contributorId,
      gsiPending: 'PENDING',
      createdAt: NOW.toISOString(),
      expiresAt: Math.floor(NOW.getTime() / 1000) + 365 * 86_400,
      cells: record.cells,
      corners: record.corners,
    })
    expect(item?.userId).toBeUndefined()
  })

  it('makes one row for a repeat and returns a fresh URL', async () => {
    reset()
    const record = fixture('good-2')
    const first = await handleScan(deps(), event(record))
    const second = await handleScan(deps(), event(record))
    expect(second.statusCode).toBe(200)
    expect(JSON.parse(second.body ?? '').uploadUrl).not.toBe(JSON.parse(first.body ?? '').uploadUrl)
    const Items = await scanRows(`CONTRIB#${record.contributorId}`, `SCAN#${record.scanId}`)
    expect(Items).toHaveLength(1)
  })

  it('stores a USER row for a valid token', async () => {
    reset()
    const record = fixture('good-3')
    const response = await handleScan(
      deps(),
      event(record, { 'x-app-key': KEY, ...JPEG, authorization: 'Bearer good' }),
    )
    expect(response.statusCode).toBe(200)
    const identity = await getItem(table, identityKey('user_clerk_1'))
    const userId = String(identity?.userId)
    const item = await row(`USER#${userId}`, `SCAN#${record.scanId}`)
    expect(item).toMatchObject({ contributorId: record.contributorId, userId, gsiPending: 'PENDING' })
    expect(await row(`CONTRIB#${record.contributorId}`, `SCAN#${record.scanId}`)).toBeUndefined()
    expect(JSON.stringify(logged)).not.toContain('good')
  })

  it('keeps one row when a signed-out send comes before a signed-in repeat', async () => {
    reset()
    const record: Record<string, unknown> = { ...fixture('good-1'), scanId: '44444444-4444-4444-8444-444444444444' }
    await handleScan(deps(), event(record))
    const repeat = await handleScan(deps(), event(record, { 'x-app-key': KEY, ...JPEG, authorization: 'Bearer good' }))
    expect(repeat.statusCode).toBe(200)
    expect(presigned).toHaveLength(2)
    const Items = await scanRows(`CONTRIB#${record.contributorId}`, `SCAN#${record.scanId}`)
    expect(Items).toHaveLength(1)
    const identity = await getItem(table, identityKey('user_clerk_1'))
    expect(await row(`USER#${String(identity?.userId)}`, `SCAN#${record.scanId}`)).toBeUndefined()
  })

  it('answers 401 for an expired or invalid token and writes nothing', async () => {
    reset()
    const record: Record<string, unknown> = { ...fixture('good-1'), scanId: '11111111-1111-4111-8111-111111111111' }
    const response = await handleScan(
      deps(),
      event(record, { 'x-app-key': KEY, ...JPEG, authorization: 'Bearer expired' }),
    )
    expect(response.statusCode).toBe(401)
    expect(await row(`CONTRIB#${record.contributorId}`, `SCAN#${record.scanId}`)).toBeUndefined()
    expect(presigned).toEqual([])
  })
})
