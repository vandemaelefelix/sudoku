import { devWarn, errorMessage } from '@/utils/log.utils'
import {
  APP_KEY_HEADER,
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  JPEG_BYTES_HEADER,
  REQUEST_TIMEOUT_MS,
  UPLOAD_TIMEOUT_MS,
} from './constants/scanShare.constants'
import type { QueuedScan, ScanQueue } from './queue'

type Response = { status: number; json(): Promise<unknown> }
type Init = { method: 'POST' | 'PUT'; headers: Record<string, string>; body: string | Uint8Array; signal: AbortSignal }

/** The part of `fetch` that the uploader uses. Tests give a fake. */
export type FetchLike = (url: string, init: Init) => Promise<Response>

/** done: the server has the scan. retry: try again later. reject: the server or the file will never take this scan. */
export type UploadResult = 'done' | 'retry' | 'reject'

export type UploaderOptions = {
  baseUrl: string
  appKey: string
  fetch?: FetchLike
  /** The sync API token of a signed-in player, or null. Never throws. */
  getToken(): Promise<string | null>
  readPhoto(path: string): Promise<Uint8Array>
}

async function timed<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await run(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Sends one queued scan (ADR-030): `POST /v1/scans` with the record and the photo length, then `PUT` of the JPEG to
 * the presigned URL. The URL signs that length, so S3 refuses a photo of another size.
 * A repeat sends the same `scanId`, so the route makes no second row. It never throws and logs the status only.
 * A 401 with a token means the token expired. The uploader then sends the same request once without the header,
 * because the scan counts for the device, not for the account.
 */
export function createUploader({
  baseUrl,
  appKey,
  fetch = globalThis.fetch as FetchLike,
  getToken,
  readPhoto,
}: UploaderOptions) {
  const post = (scan: QueuedScan, token: string | null, photoBytes: number) =>
    timed(REQUEST_TIMEOUT_MS, (signal) =>
      fetch(`${baseUrl}/v1/scans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [APP_KEY_HEADER]: appKey,
          [JPEG_BYTES_HEADER]: String(photoBytes),
          ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
        },
        body: scan.record,
        signal,
      }),
    )

  return {
    async upload(scan: QueuedScan): Promise<UploadResult> {
      let photo: Uint8Array
      try {
        photo = await readPhoto(scan.photoPath)
      } catch (error) {
        devWarn('scanShare', `the photo is gone: ${errorMessage(error)}`)
        return 'reject'
      }
      try {
        const token = await getToken()
        let response = await post(scan, token, photo.byteLength)
        // 410 is a deleted account: the scan still goes up as an anonymous contribution.
        if ((response.status === 401 || response.status === 410) && token !== null)
          response = await post(scan, null, photo.byteLength)
        if (response.status === 410) return 'reject'
        if (response.status === 400 || response.status === 413) return 'reject'
        if (response.status !== 200) {
          devWarn('scanShare', `the scans route answered ${response.status}`)
          return 'retry'
        }
        const body = (await response.json().catch(() => null)) as { uploadUrl?: unknown } | null
        const url = body?.uploadUrl
        if (typeof url !== 'string' || !url.startsWith('https://')) return 'retry'
        const put = await timed(UPLOAD_TIMEOUT_MS, (signal) =>
          fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(photo.byteLength) },
            body: photo,
            signal,
          }),
        )
        if (put.status >= 200 && put.status < 300) return 'done'
        devWarn('scanShare', `the photo upload answered ${put.status}`)
        return 'retry'
      } catch (error) {
        devWarn('scanShare', `the upload failed: ${errorMessage(error)}`)
        return 'retry'
      }
    },
  }
}

export type DrainOptions = {
  queue: ScanQueue
  upload(scan: QueuedScan): Promise<UploadResult>
  /** Read before each scan: the player can turn sharing off while a drain runs. */
  isOn(): boolean
  /** The first-upload notice was shown. Nothing uploads before (ADR-030). */
  noticeSeen(): boolean
  now(): number
  deletePhoto(path: string): void
}

/** Milliseconds to wait after `attempts` failed tries. Doubles each try up to BACKOFF_MAX_MS. */
export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** attempts, BACKOFF_MAX_MS)
}

/**
 * Builds `drainQueue`: it sends the due scans one by one and stops at the first failure, because the phone is probably offline.
 * A failed scan waits with backoff. Two calls at once share one run.
 */
export function createDrain({
  queue,
  upload,
  isOn: sharingOn,
  noticeSeen,
  now,
  deletePhoto,
}: DrainOptions): () => Promise<void> {
  let running: Promise<void> | null = null
  const isOn = () => sharingOn() && noticeSeen()

  async function run(): Promise<void> {
    while (isOn()) {
      // oxlint-disable-next-line no-await-in-loop -- the scans go in order, one request at a time.
      const scan = await queue.next(now())
      if (scan === null || !isOn()) return
      // oxlint-disable-next-line no-await-in-loop -- see above.
      const result = await upload(scan)
      if (!isOn()) return
      if (result === 'retry') {
        // oxlint-disable-next-line no-await-in-loop -- see above.
        await queue.fail(scan.scanId, now() + backoffMs(scan.attempts))
        return
      }
      // oxlint-disable-next-line no-await-in-loop -- see above.
      await queue.remove(scan.scanId)
      deletePhoto(scan.photoPath)
    }
  }

  return () => {
    running ??= run()
      .catch((error: unknown) => devWarn('scanShare', `the drain stopped: ${errorMessage(error)}`))
      .finally(() => {
        running = null
      })
    return running
  }
}
