import { openDatabaseAsync } from 'expo-sqlite'
import { QUEUE_DATABASE_NAME } from './constants/scanShare.constants'
import { createScanQueue, type ScanQueue } from './queue'

let opening: Promise<ScanQueue> | null = null

/** Opens the queue database once. A failed open is not kept, so the next call tries again. */
export function openQueue(): Promise<ScanQueue> {
  opening ??= openDatabaseAsync(QUEUE_DATABASE_NAME)
    .then((db) => createScanQueue(db))
    .catch((error: unknown) => {
      opening = null
      throw error
    })
  return opening
}

export const lazyQueue: ScanQueue = {
  enqueue: async (scan, now) => (await openQueue()).enqueue(scan, now),
  next: async (now) => (await openQueue()).next(now),
  remove: async (id) => (await openQueue()).remove(id),
  fail: async (id, at) => (await openQueue()).fail(id, at),
  clear: async () => (await openQueue()).clear(),
}
