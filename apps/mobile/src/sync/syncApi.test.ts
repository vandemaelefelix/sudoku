import { createSyncApi, type FetchLike } from './syncApi'

const URL_BASE = 'https://abc.execute-api.eu-west-1.amazonaws.com'
const REQUEST = { entries: [], cursor: null }
const PAGE = { acceptedIds: [], changes: [{ any: 'thing' }], cursor: 'c1', more: false }

function reply(status: number, body: unknown, headers: Record<string, string> = {}): ReturnType<FetchLike> {
  return Promise.resolve({
    status,
    headers: { get: (name: string) => headers[name] ?? null },
    json: async () => {
      if (body === undefined) throw new SyntaxError('no body')
      return body
    },
  })
}

function apiWith(fetch: FetchLike, timeoutMs?: number) {
  return createSyncApi({ baseUrl: URL_BASE, fetch, ...(timeoutMs === undefined ? {} : { timeoutMs }) })
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  jest.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

it('posts the request with the token in the header', async () => {
  const fetch = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(() => reply(200, PAGE))
  const result = await apiWith(fetch).sync({ entries: [], cursor: 'c0' }, 'secret-token')
  expect(result).toEqual({ kind: 'ok', body: PAGE })
  const [url, init] = fetch.mock.calls[0]!
  expect(url).toBe(`${URL_BASE}/v1/sync`)
  expect(init.method).toBe('POST')
  expect(init.headers).toEqual({ Authorization: 'Bearer secret-token', 'Content-Type': 'application/json' })
  expect(JSON.parse(init.body)).toEqual({ entries: [], cursor: 'c0' })
})

it.each([
  ['a 400 invalid_cursor', 400, { code: 'invalid_cursor', message: 'No.' }, { kind: 'cursor_invalid' }],
  ['a 400 invalid_request', 400, { code: 'invalid_request', message: 'No.' }, { kind: 'rejected' }],
  ['a 400 without a body we know', 400, { message: 'x' }, { kind: 'rejected' }],
  ['a 401', 401, { message: 'Unauthorized' }, { kind: 'unauthorized' }],
  ['a 410 account_deleted', 410, { code: 'account_deleted', message: 'Gone.' }, { kind: 'account_deleted' }],
  ['another 410', 410, { message: 'Gone' }, { kind: 'server_error' }],
  ['a 429', 429, { message: 'Too Many Requests' }, { kind: 'throttled', retryAfterMs: null }],
  ['a 500', 500, { message: 'Internal Server Error' }, { kind: 'server_error' }],
  ['a 503', 503, { message: 'Service Unavailable' }, { kind: 'server_error' }],
  ['a 404', 404, { message: 'Not Found' }, { kind: 'server_error' }],
  ['a 200 with a body that is not a page', 200, { nope: true }, { kind: 'server_error' }],
  ['a 200 without a JSON body', 200, undefined, { kind: 'server_error' }],
])('maps %s', async (_name, status, body, expected) => {
  await expect(apiWith(() => reply(status, body)).sync(REQUEST, 't')).resolves.toEqual(expected)
})

it('reads Retry-After in seconds and caps it at 15 minutes', async () => {
  await expect(apiWith(() => reply(429, {}, { 'Retry-After': '120' })).sync(REQUEST, 't')).resolves.toEqual({
    kind: 'throttled',
    retryAfterMs: 120_000,
  })
  await expect(apiWith(() => reply(429, {}, { 'Retry-After': '99999' })).sync(REQUEST, 't')).resolves.toEqual({
    kind: 'throttled',
    retryAfterMs: 900_000,
  })
  await expect(apiWith(() => reply(429, {}, { 'Retry-After': 'soon' })).sync(REQUEST, 't')).resolves.toEqual({
    kind: 'throttled',
    retryAfterMs: null,
  })
})

it('keeps the changes of a page as they are, so the run can check them one by one', async () => {
  const page = { ...PAGE, changes: [1, 'two', null] }
  await expect(apiWith(() => reply(200, page)).sync(REQUEST, 't')).resolves.toEqual({ kind: 'ok', body: page })
})

it('treats a network error as offline', async () => {
  await expect(
    apiWith(() => Promise.reject(new TypeError('Network request failed'))).sync(REQUEST, 't'),
  ).resolves.toEqual({
    kind: 'offline',
  })
})

const hangingFetch: FetchLike = (_url, init) =>
  new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('aborted')))
  })

it('treats a timeout as offline', async () => {
  jest.useFakeTimers()
  try {
    const pending = apiWith(hangingFetch, 5_000).sync(REQUEST, 't')
    await jest.advanceTimersByTimeAsync(5_000)
    await expect(pending).resolves.toEqual({ kind: 'offline' })
  } finally {
    jest.useRealTimers()
  }
})

it('never logs the token or the body', async () => {
  await apiWith(() => reply(500, { message: 'secret-body' })).sync(
    { entries: [], cursor: 'secret-cursor' },
    'secret-token',
  )
  await apiWith(() => Promise.reject(new TypeError('secret-token failed'))).sync(REQUEST, 'secret-token')
  const logged = JSON.stringify([...jest.mocked(console.warn).mock.calls, ...jest.mocked(console.log).mock.calls])
  expect(logged).toContain('500')
  expect(logged).not.toContain('secret')
})

it('aborts the request when the signal of the caller aborts', async () => {
  const caller = new AbortController()
  let seen: AbortSignal | null = null
  const fetch: FetchLike = (_url, init) => {
    seen = init.signal
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))
  }
  const pending = apiWith(fetch).sync(REQUEST, 'token', caller.signal)
  caller.abort()
  await expect(pending).resolves.toEqual({ kind: 'offline' })
  expect(seen).not.toBeNull()
})
