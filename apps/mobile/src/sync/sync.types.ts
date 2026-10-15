import type { HistoryRecord } from '@/storage'

export type SyncTrigger = 'game-end' | 'foreground' | 'network' | 'sign-in'

/** The player who syncs now. `isCurrent` turns false when a sign-out or another account ends the session. */
export type SyncSession = {
  owner: string
  /** `fresh` asks for a token that skips the cache. The run uses it once after a 401. */
  getToken(options?: { fresh?: boolean }): Promise<string | null>
  isCurrent(): boolean
}

/** The lenient body of a 200: the changes are checked one by one, so one bad entry cannot reject a page. */
export type SyncPage = { acceptedIds: string[]; changes: unknown[]; cursor: string; more: boolean }

/** The API client never throws. The kind says what the run does next (ADR-028, decision 8). */
export type SyncApiResult =
  | { kind: 'ok'; body: SyncPage }
  | { kind: 'cursor_invalid' }
  | { kind: 'account_deleted' }
  | { kind: 'unauthorized' }
  | { kind: 'offline' }
  | { kind: 'throttled'; retryAfterMs: number | null }
  | { kind: 'server_error' }
  | { kind: 'rejected' }

/** `partial` means the run stopped at the most rounds with work left. It is not a failure: no backoff. */
export type RunResult = 'synced' | 'partial' | 'failed' | 'skipped' | 'stopped' | 'deleted'

/** `changed` is true when the run wrote entries from another device. `retryAfterMs` comes from a 429. */
export type RunOutcome = { result: RunResult; changed: boolean; retryAfterMs: number | null }

export type SyncStatus = { lastSyncedAt: string | null; revision: number }

export type RemoteRecords = { records: HistoryRecord[]; dropped: number }
