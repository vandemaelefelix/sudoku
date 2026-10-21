import { createClerkAdapter } from './clerkAdapter.utils'

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
})
afterEach(() => jest.restoreAllMocks())

function adapter(overrides: Partial<Parameters<typeof createClerkAdapter>[0]> = {}) {
  const getToken = jest.fn(async () => 'jwt')
  const signOut = jest.fn(async () => undefined)
  return { getToken, signOut, clerk: createClerkAdapter({ getToken, signOut, ...overrides }) }
}

describe('getApiToken', () => {
  it('asks for the sync API template, and skips the Clerk cache only for a fresh token', async () => {
    const { clerk, getToken } = adapter()
    await expect(clerk.getApiToken()).resolves.toBe('jwt')
    expect(getToken).toHaveBeenLastCalledWith({ template: 'sudoku-api' })
    await clerk.getApiToken({ fresh: true })
    expect(getToken).toHaveBeenLastCalledWith({ template: 'sudoku-api', skipCache: true })
  })

  it('gives null and warns when Clerk throws', async () => {
    const { clerk } = adapter({
      getToken: async () => {
        throw new Error('offline')
      },
    })
    await expect(clerk.getApiToken()).resolves.toBeNull()
    expect(console.warn).toHaveBeenCalledWith('[account] Clerk gave no API token: offline')
  })
})

describe('signOut', () => {
  it('gives true when Clerk signs out', async () => {
    const { clerk, signOut } = adapter()
    await expect(clerk.signOut()).resolves.toBe(true)
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('gives false and warns when Clerk throws', async () => {
    const { clerk } = adapter({
      signOut: async () => {
        throw new Error('network down')
      },
    })
    await expect(clerk.signOut()).resolves.toBe(false)
    expect(console.warn).toHaveBeenCalledWith('[account] Clerk did not sign out: network down')
  })
})
