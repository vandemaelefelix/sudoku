import { describe, expect, it } from 'vitest'
import { route } from '../../src/route'
import { syncEvent } from '../db/event'
import type { SyncDeps } from '../../src/deps'

const deps = {
  log: () => undefined,
  clerk: { deleteUser: async () => undefined },
} as unknown as SyncDeps

describe('route', () => {
  it('answers 404 for an unknown route', async () => {
    expect((await route(deps, syncEvent({}, { routeKey: 'GET /v1/other' }))).statusCode).toBe(404)
  })

  it('answers 401 on DELETE /v1/account without a sub', async () => {
    const response = await route(deps, syncEvent(null, { sub: null, routeKey: 'DELETE /v1/account' }))
    expect(response.statusCode).toBe(401)
  })
})
