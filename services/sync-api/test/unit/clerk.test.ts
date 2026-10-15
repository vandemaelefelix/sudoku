import { describe, expect, it } from 'vitest'
import { ClerkError, createClerkClient } from '../../src/clerk'

type Call = [string, RequestInit]

const reply = (status: number) => {
  const calls: Call[] = []
  const fetchFake = async (url: string, init: RequestInit) => {
    calls.push([url, init])
    return new Response('{"errors":[{"message":"secret detail"}]}', { status })
  }
  return { calls, fetchFake }
}

const failing = async (): Promise<Response> => {
  throw new TypeError('connect ECONNRESET')
}

const hanging = (_url: string, init: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
  })

describe('createClerkClient', () => {
  it('sends DELETE with the bearer key and the encoded user ID', async () => {
    const { calls, fetchFake } = reply(200)
    await createClerkClient('sk_test_key', fetchFake).deleteUser('user/a b')
    const [url, init] = calls[0] as Call
    expect(url).toBe('https://api.clerk.com/v1/users/user%2Fa%20b')
    expect(init.method).toBe('DELETE')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk_test_key')
  })

  it.each([200, 404])('treats %i as deleted', async (status) => {
    await expect(createClerkClient('k', reply(status).fetchFake).deleteUser('u')).resolves.toBeUndefined()
  })

  it.each([401, 429, 500])('rejects with ClerkError on %i, with the status only', async (status) => {
    const error = await createClerkClient('k', reply(status).fetchFake)
      .deleteUser('u')
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ClerkError)
    expect((error as ClerkError).message).toBe(`Clerk answered ${status}.`)
  })

  it('rejects on a network error', async () => {
    await expect(createClerkClient('k', failing).deleteUser('u')).rejects.toBeInstanceOf(ClerkError)
  })

  it('aborts after the timeout', async () => {
    await expect(createClerkClient('k', hanging, 20).deleteUser('u')).rejects.toBeInstanceOf(ClerkError)
  })
})
