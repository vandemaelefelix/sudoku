import type { SyncRequest } from '@sudoku/sync-contract'
import { createMemoryStorage, toWireEntry, type GameStorage, type StorageDeps } from '@/storage'
import { newGame, seedCursor, uuid, wonGame } from '@/storage/contract/fixtures.testkit'
import type { SyncApi } from './syncApi'
import type { SyncApiResult } from './sync.types'

export const ALICE = 'user-alice'
export const BOB = 'user-bob'

export { seedCursor, uuid }

/** Memory storage with UUID ids, as the sync contract needs. The clock moves one second per call. */
export function createTestStorage(): GameStorage {
  let ids = 0
  let seconds = 0
  const deps: StorageDeps = {
    newId: () => uuid(++ids),
    now: () => new Date(Date.UTC(2026, 9, 15, 9, 0, 0) + 1000 * seconds++).toISOString(),
  }
  return createMemoryStorage(deps)
}

export async function finishGame(storage: GameStorage, owner: string | null): Promise<string> {
  const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner })
  await storage.puzzles.save(id, wonGame(60_000), owner)
  return id
}

/** An API that gives scripted answers, in order. The last one repeats. It records every request and token. */
export function scriptedApi(
  answers: (SyncApiResult | ((request: SyncRequest, token: string) => SyncApiResult | Promise<SyncApiResult>))[],
) {
  const requests: SyncRequest[] = []
  const tokens: string[] = []
  const api: SyncApi = {
    async sync(request, token) {
      requests.push(request)
      tokens.push(token)
      const answer = answers[Math.min(requests.length - 1, answers.length - 1)]!
      return typeof answer === 'function' ? answer(request, token) : answer
    },
  }
  return { api, requests, tokens }
}

/** A small server: it stores what it accepts per token, and pages the changes by position. */
export function fakeServer({ pageSize = 500, cap = Infinity }: { pageSize?: number; cap?: number } = {}) {
  const stores = new Map<string, ReturnType<typeof toWireEntry>[]>()
  const requests: SyncRequest[] = []
  const api: SyncApi = {
    async sync(request, token) {
      requests.push(request)
      const store = stores.get(token) ?? []
      stores.set(token, store)
      const acceptedIds: string[] = []
      for (const entry of request.entries.slice(0, cap)) {
        const at = store.findIndex((held) => held.id === entry.id)
        if (at === -1) store.push(entry)
        else if (store[at]!.updatedAt < entry.updatedAt) store[at] = entry
        acceptedIds.push(entry.id)
      }
      const from = request.cursor === null ? 0 : Number(request.cursor)
      const changes = store.slice(from, from + pageSize)
      const next = from + changes.length
      return { kind: 'ok', body: { acceptedIds, changes, cursor: String(next), more: next < store.length } }
    },
  }
  return { api, requests, stores }
}

export const noSleep = async () => undefined
