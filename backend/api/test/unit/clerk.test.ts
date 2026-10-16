import { describe, expect, it } from 'vitest'
import { ClerkError, createClerkClient, lazyClerkClient } from '../../src/clerk'

type Call = [string, RequestInit]

const NOT_FOUND = '{"errors":[{"message":"Resource not found","code":"resource_not_found"}]}'

const reply = (status: number, body = '{"errors":[{"message":"secret detail"}]}') => {
  const calls: Call[] = []
  const fetchFake = async (url: string, init: RequestInit) => {
    calls.push([url, init])
    return new Response(body, { status })
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

  it('treats 200 as deleted', async () => {
    await expect(createClerkClient('k', reply(200).fetchFake).deleteUser('u')).resolves.toBeUndefined()
  })

  it('treats 404 with the code resource_not_found as already deleted', async () => {
    await expect(createClerkClient('k', reply(404, NOT_FOUND).fetchFake).deleteUser('u')).resolves.toBeUndefined()
  })

  it.each([
    ['another code', '{"errors":[{"code":"route_not_found"}]}'],
    ['no JSON', '<html>Not Found</html>'],
    ['an empty body', ''],
  ])('rejects a 404 with %s', async (_name, body) => {
    const error = await createClerkClient('k', reply(404, body).fetchFake)
      .deleteUser('u')
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ClerkError)
    expect((error as ClerkError).message).toBe('Clerk answered 404.')
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

describe('lazyClerkClient', () => {
  it('rejects with ClerkError when the stage has no Clerk secret', async () => {
    const client = lazyClerkClient(() => {
      throw new Error('ClerkSecretKey is not linked.')
    })
    const error = await client.deleteUser('u').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ClerkError)
    expect((error as ClerkError).message).toBe('No Clerk secret is linked.')
  })

  it('reads the secret only when it deletes', async () => {
    let reads = 0
    lazyClerkClient(() => String(++reads))
    expect(reads).toBe(0)
  })
})
