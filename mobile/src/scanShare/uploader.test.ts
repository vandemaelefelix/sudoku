import { openNodeDatabase, type NodeDatabase } from '@/storage/nodeDatabase'
import { BACKOFF_BASE_MS, BACKOFF_MAX_MS } from './constants/scanShare.constants'
import { createScanQueue, type QueuedScan, type ScanQueue } from './queue'
import { backoffMs, createDrain, createUploader, type FetchLike } from './uploader'

const RECORD = JSON.stringify({ scanId: 'scan-1' })
const SCAN: QueuedScan = { scanId: 'scan-1', record: RECORD, photoPath: '/q/scan-1.jpg', attempts: 0 }
const PHOTO = new Uint8Array([1, 2, 3])
const URL_OK = 'https://bucket.example/scans/scan-1.jpg?sig=x'

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown }

function fakeFetch(answers: { status: number; body?: unknown }[]) {
  const calls: Call[] = []
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body })
    const answer = answers[Math.min(calls.length - 1, answers.length - 1)]!
    return { status: answer.status, json: async () => answer.body }
  }
  return { fetch, calls }
}

function uploader(fetch: FetchLike, token: string | null = null, readPhoto = async () => PHOTO) {
  return createUploader({
    baseUrl: 'https://api.example',
    appKey: 'app-key',
    fetch,
    getToken: async () => token,
    readPhoto,
  })
}

const offline: FetchLike = async () => {
  throw new TypeError('Network request failed')
}
const gone = async () => {
  throw new Error('no file')
}

describe('upload', () => {
  it('posts the record with the app key, then puts the JPEG to the presigned URL', async () => {
    const { fetch, calls } = fakeFetch([{ status: 200, body: { uploadUrl: URL_OK } }, { status: 200 }])
    expect(await uploader(fetch).upload(SCAN)).toBe('done')
    expect(calls[0]).toMatchObject({ url: 'https://api.example/v1/scans', method: 'POST', body: RECORD })
    expect(calls[0]?.headers).toMatchObject({
      'x-app-key': 'app-key',
      'Content-Type': 'application/json',
      'x-jpeg-bytes': '3',
    })
    expect(calls[0]?.headers.Authorization).toBeUndefined()
    expect(calls[1]).toMatchObject({ url: URL_OK, method: 'PUT', body: PHOTO })
    expect(calls[1]?.headers).toEqual({ 'Content-Type': 'image/jpeg', 'Content-Length': '3' })
  })

  it('sends the token of a signed-in player', async () => {
    const { fetch, calls } = fakeFetch([{ status: 200, body: { uploadUrl: URL_OK } }, { status: 200 }])
    await uploader(fetch, 'jwt').upload(SCAN)
    expect(calls[0]?.headers.Authorization).toBe('Bearer jwt')
  })

  it('drops the header once after a 401 and sends the same scanId again', async () => {
    const { fetch, calls } = fakeFetch([{ status: 401 }, { status: 200, body: { uploadUrl: URL_OK } }, { status: 200 }])
    expect(await uploader(fetch, 'expired').upload(SCAN)).toBe('done')
    expect(calls).toHaveLength(3)
    expect(calls[0]?.headers.Authorization).toBe('Bearer expired')
    expect(calls[1]?.headers.Authorization).toBeUndefined()
    expect(calls[1]?.body).toBe(RECORD)
  })

  it('drops the header once after a 410 and rejects when the route still answers 410', async () => {
    const { fetch, calls } = fakeFetch([{ status: 410 }])
    expect(await uploader(fetch, 'jwt').upload(SCAN)).toBe('reject')
    expect(calls).toHaveLength(2)
    expect(calls[1]?.headers.Authorization).toBeUndefined()
  })

  it('sends the scan without the token after a 410', async () => {
    const { fetch } = fakeFetch([{ status: 410 }, { status: 200, body: { uploadUrl: URL_OK } }, { status: 200 }])
    expect(await uploader(fetch, 'jwt').upload(SCAN)).toBe('done')
  })

  it('retries later after a 401 without a token, because the app key is wrong', async () => {
    const { fetch, calls } = fakeFetch([{ status: 401 }])
    expect(await uploader(fetch).upload(SCAN)).toBe('retry')
    expect(calls).toHaveLength(1)
  })

  it.each([429, 500, 503])('retries later after a %i', async (status) => {
    expect(await uploader(fakeFetch([{ status }]).fetch).upload(SCAN)).toBe('retry')
  })

  it('rejects a scan that the route refuses as invalid', async () => {
    expect(await uploader(fakeFetch([{ status: 400 }]).fetch).upload(SCAN)).toBe('reject')
  })

  it('retries when the phone is offline', async () => {
    expect(await uploader(offline).upload(SCAN)).toBe('retry')
  })

  it('retries when the photo upload fails, and asks for a new URL the next time', async () => {
    const { fetch } = fakeFetch([{ status: 200, body: { uploadUrl: URL_OK } }, { status: 500 }])
    expect(await uploader(fetch).upload(SCAN)).toBe('retry')
  })

  it('retries when the answer has no https upload URL', async () => {
    expect(await uploader(fakeFetch([{ status: 200, body: { uploadUrl: 'http://x' } }]).fetch).upload(SCAN)).toBe(
      'retry',
    )
  })

  it('rejects a scan whose photo file is gone, without a request', async () => {
    const { fetch, calls } = fakeFetch([{ status: 200 }])
    expect(await uploader(fetch, null, gone).upload(SCAN)).toBe('reject')
    expect(calls).toHaveLength(0)
  })
})

describe('backoffMs', () => {
  it('doubles up to the maximum', () => {
    expect(backoffMs(0)).toBe(BACKOFF_BASE_MS)
    expect(backoffMs(1)).toBe(2 * BACKOFF_BASE_MS)
    expect(backoffMs(30)).toBe(BACKOFF_MAX_MS)
  })
})

const scan = (id: string) => ({ scanId: id, record: RECORD, photoPath: `/q/${id}.jpg` })

describe('drainQueue', () => {
  let db: NodeDatabase
  let queue: ScanQueue
  let clock: number
  let on: boolean
  let seen: boolean
  let deleted: string[]
  beforeEach(async () => {
    db = openNodeDatabase()
    queue = await createScanQueue(db)
    clock = 1_000
    on = true
    seen = true
    deleted = []
  })
  afterEach(() => db.close())

  const drain = (upload: (s: QueuedScan) => Promise<'done' | 'retry' | 'reject'>) =>
    createDrain({
      queue,
      upload,
      isOn: () => on,
      noticeSeen: () => seen,
      now: () => clock,
      deletePhoto: (path) => deleted.push(path),
    })

  it('sends nothing until the player has seen the notice, and keeps the scans', async () => {
    await queue.enqueue(scan('a'), 1)
    seen = false
    const upload = jest.fn(async () => 'done' as const)
    await drain(upload)()
    expect(upload).not.toHaveBeenCalled()
    expect(await queue.next(clock)).toMatchObject({ scanId: 'a' })
    seen = true
    await drain(upload)()
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('uploads every due scan, removes the rows and deletes the photos', async () => {
    await queue.enqueue(scan('a'), 1)
    await queue.enqueue(scan('b'), 2)
    const sent: string[] = []
    await drain(async (s) => (sent.push(s.scanId), 'done'))()
    expect(sent).toEqual(['a', 'b'])
    expect(await queue.next(clock)).toBeNull()
    expect(deleted).toEqual(['/q/a.jpg', '/q/b.jpg'])
  })

  it('stops at the first failure and holds that scan back with backoff', async () => {
    await queue.enqueue(scan('a'), 1)
    await queue.enqueue(scan('b'), 2)
    const sent: string[] = []
    await drain(async (s) => (sent.push(s.scanId), 'retry'))()
    expect(sent).toEqual(['a'])
    expect(await queue.next(clock + BACKOFF_BASE_MS - 1)).toMatchObject({ scanId: 'b' })
    clock += BACKOFF_BASE_MS
    expect(await queue.next(clock)).toMatchObject({ scanId: 'a', attempts: 1 })
    expect(deleted).toEqual([])
  })

  it('drains later: the scans survive a pause of days', async () => {
    await queue.enqueue(scan('a'), 1)
    await drain(async () => 'retry')()
    clock += 3 * 24 * 60 * 60_000
    await drain(async () => 'done')()
    expect(await queue.next(clock)).toBeNull()
  })

  it('removes a rejected scan', async () => {
    await queue.enqueue(scan('a'), 1)
    await drain(async () => 'reject')()
    expect(await queue.next(clock)).toBeNull()
  })

  it('uploads nothing while sharing is off', async () => {
    await queue.enqueue(scan('a'), 1)
    on = false
    const upload = jest.fn(async () => 'done' as const)
    await drain(upload)()
    expect(upload).not.toHaveBeenCalled()
  })

  it('stops when the player turns sharing off during an upload, and keeps the row for the clear', async () => {
    await queue.enqueue(scan('a'), 1)
    await queue.enqueue(scan('b'), 2)
    const sent: string[] = []
    await drain(async (s) => {
      sent.push(s.scanId)
      on = false
      return 'done'
    })()
    expect(sent).toEqual(['a'])
  })

  it('shares one run between two calls at once', async () => {
    await queue.enqueue(scan('a'), 1)
    const upload = jest.fn(async () => 'done' as const)
    const run = drain(upload)
    await Promise.all([run(), run()])
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('survives an upload that throws', async () => {
    await queue.enqueue(scan('a'), 1)
    await expect(
      drain(async () => {
        throw new Error('boom')
      })(),
    ).resolves.toBeUndefined()
  })
})
