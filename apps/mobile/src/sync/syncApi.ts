import { errorBodySchema, MAX_CHANGES_PER_SYNC, syncResponseSchema, type SyncRequest } from '@sudoku/sync-contract'
import { devWarn } from '@/utils/log.utils'
import { BACKOFF_MAX_MS, REQUEST_TIMEOUT_MS } from './constants/sync.constants'
import type { SyncApiResult } from './sync.types'

/** The part of `fetch` that the client uses. Tests give a fake. */
export type FetchLike = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ status: number; headers: { get(name: string): string | null }; json(): Promise<unknown> }>

// The strict contract schema would reject a whole page for one bad change. The run checks each change alone.
const envelopeSchema = syncResponseSchema.omit({ changes: true })

export type SyncApi = { sync(request: SyncRequest, token: string): Promise<SyncApiResult> }

type SyncApiOptions = { baseUrl: string; fetch?: FetchLike; timeoutMs?: number }

async function jsonOrNull(response: Awaited<ReturnType<FetchLike>>): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function retryAfterMs(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null
  return Math.min(Number(value) * 1000, BACKOFF_MAX_MS)
}

/**
 * The client of `POST /v1/sync` (ADR-028). It never throws and never retries: the service owns the backoff.
 * It reads the status first, because API Gateway sends its own bodies for 401, 429 and 5xx.
 * It logs the status only, never the token, the cursor or a body.
 */
export function createSyncApi({
  baseUrl,
  fetch = globalThis.fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
}: SyncApiOptions): SyncApi {
  return {
    async sync(request, token) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(`${baseUrl}/v1/sync`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: controller.signal,
        })
        return await resultOf(response)
      } catch {
        return { kind: 'offline' }
      } finally {
        clearTimeout(timer)
      }
    },
  }
}

async function resultOf(response: Awaited<ReturnType<FetchLike>>): Promise<SyncApiResult> {
  const { status } = response
  if (status === 200) {
    const body = await jsonOrNull(response)
    const envelope = envelopeSchema.safeParse(body)
    const changes = (body as { changes?: unknown } | null)?.changes
    if (envelope.success && Array.isArray(changes) && changes.length <= MAX_CHANGES_PER_SYNC) {
      return { kind: 'ok', body: { ...envelope.data, changes } }
    }
  } else if (status === 400) {
    const parsed = errorBodySchema.safeParse(await jsonOrNull(response))
    return parsed.success && parsed.data.code === 'invalid_cursor' ? { kind: 'cursor_invalid' } : { kind: 'rejected' }
  } else if (status === 401) {
    return { kind: 'unauthorized' }
  } else if (status === 410) {
    const parsed = errorBodySchema.safeParse(await jsonOrNull(response))
    if (parsed.success && parsed.data.code === 'account_deleted') return { kind: 'account_deleted' }
  } else if (status === 429) {
    return { kind: 'throttled', retryAfterMs: retryAfterMs(response.headers.get('Retry-After')) }
  }
  devWarn('sync', `The sync API answered ${status}`)
  return { kind: 'server_error' }
}
